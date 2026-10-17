import { hasValidSession } from "./auth.js";
import { el, clear, toast } from "./dom.js";
import { listPlaces, bulkImportPlaces } from "./api.js";
import { decodeFile, parseCsv, toCsv } from "./csv.js";
import { readTable, checkRecords, nameKey, templateRows } from "./import-rules.js";

const MAX_ROWS = 1000;
const CHUNK_ITEMS = 25;
const CHUNK_BYTES = 8000;

const state = { rows: [], existing: new Set(), importing: false, finished: false };

const fileInput = document.getElementById("file-input");
const fileName = document.getElementById("file-name");
const statusLine = document.getElementById("status-line");
const review = document.getElementById("review");
const summary = document.getElementById("summary");
const body = document.getElementById("import-body");
const importButton = document.getElementById("import-button");
const resetButton = document.getElementById("reset-button");
const doneLink = document.getElementById("done-link");
const problemsOnly = document.getElementById("problems-only");

function setStatus(message, isError) {
    statusLine.textContent = message;
    statusLine.className = isError ? "error" : "";
}

function mode() {
    return document.querySelector("input[name='mode']:checked").value;
}

function importable() {
    return state.rows.filter((r) => r.status === "ready" || (r.status === "exists" && mode() === "update"));
}

function counts() {
    const result = { ready: 0, exists: 0, error: 0 };
    for (const row of state.rows) result[row.status] += 1;
    return result;
}

function renderSummary() {
    clear(summary);
    const c = counts();
    summary.append(
        el("span", { class: "pill", text: state.rows.length + " rows in file" }),
        el("span", { class: "pill ready", text: c.ready + " new" }),
        el("span", { class: "pill exists", text: c.exists + " already exist" }),
        el("span", { class: "pill error", text: c.error + " with problems" })
    );
}

function renderButton() {
    const count = importable().length;
    importButton.textContent = state.importing ? "Importing..." : "Import " + count + " place" + (count === 1 ? "" : "s");
    importButton.disabled = state.importing || state.finished || count === 0;
}

function renderTable() {
    clear(body);
    const rows = state.rows.filter((r) => !problemsOnly.checked || r.status === "error" || r.outcome === "failed");
    for (const row of rows) {
        const status = row.outcome || row.status;
        const labels = { ready: "New", exists: "Exists", error: "Problem", created: "Added", updated: "Updated", skipped: "Skipped", failed: "Failed" };
        body.append(
            el("tr", {}, [
                el("td", { text: row.line }),
                el("td", {}, [el("span", { class: "badge " + status, text: labels[status] })]),
                el("td", { text: row.place.name || "" }),
                el("td", { text: row.place.category || "" }),
                el("td", { text: row.place.lat === undefined ? "" : row.place.lat }),
                el("td", { text: row.place.lng === undefined ? "" : row.place.lng }),
                el("td", { text: row.place.openingHours || "" }),
                el("td", { class: "note", text: row.note || row.message })
            ])
        );
    }
    if (rows.length === 0) {
        body.append(el("tr", {}, [el("td", { colspan: "8", class: "empty-cell", text: "No rows to show." })]));
    }
}

function renderAll() {
    renderSummary();
    renderTable();
    renderButton();
}

function reset() {
    state.rows = [];
    state.finished = false;
    state.importing = false;
    fileInput.value = "";
    fileName.textContent = "";
    review.hidden = true;
    doneLink.hidden = true;
    setStatus("");
}

function chunks(rows) {
    const groups = [];
    let current = [];
    let size = 0;
    for (const row of rows) {
        const bytes = JSON.stringify(row.place).length + 1;
        if (current.length > 0 && (current.length >= CHUNK_ITEMS || size + bytes > CHUNK_BYTES)) {
            groups.push(current);
            current = [];
            size = 0;
        }
        current.push(row);
        size += bytes;
    }
    if (current.length > 0) groups.push(current);
    return groups;
}

async function runImport() {
    const rows = importable();
    if (rows.length === 0 || state.importing) return;
    state.importing = true;
    renderButton();
    resetButton.disabled = true;
    const groups = chunks(rows);
    const totals = { created: 0, updated: 0, skipped: 0, failed: 0 };
    let done = 0;
    try {
        for (const group of groups) {
            setStatus("Importing " + Math.min(done + group.length, rows.length) + " of " + rows.length + "...");
            const response = await bulkImportPlaces(group.map((r) => r.place), mode());
            for (const result of response.results) {
                const row = group[result.index];
                row.outcome = result.status;
                row.note = result.status === "failed" ? result.error : "";
                totals[result.status] += 1;
            }
            done += group.length;
            renderTable();
        }
        state.finished = true;
        setStatus(
            "Finished: " + totals.created + " added, " + totals.updated + " updated, " + totals.skipped + " skipped, " + totals.failed + " failed.",
            totals.failed > 0
        );
        toast(totals.failed > 0 ? "Import finished with some failures." : "Import finished.", totals.failed > 0 ? "error" : "ok");
        doneLink.hidden = false;
    } catch (error) {
        setStatus("Stopped after " + done + " of " + rows.length + " places: " + error.message + " Rows already marked Added are saved. Fix the problem and choose the file again to continue (existing names are skipped).", true);
        state.finished = true;
    } finally {
        state.importing = false;
        resetButton.disabled = false;
        renderAll();
    }
}

async function handleFile(file) {
    reset();
    if (!file) return;
    fileName.textContent = file.name;
    if (file.size > 2 * 1024 * 1024) {
        setStatus("That file is too big. Please keep it under 2 MB.", true);
        return;
    }
    const decoded = decodeFile(await file.arrayBuffer());
    const table = readTable(parseCsv(decoded.text));
    if (table.error) {
        setStatus(table.error, true);
        return;
    }
    if (table.records.length === 0) {
        setStatus("The file has a header row but no places.", true);
        return;
    }
    if (table.records.length > MAX_ROWS) {
        setStatus("The file has " + table.records.length + " rows. Please import at most " + MAX_ROWS + " at a time.", true);
        return;
    }
    state.rows = checkRecords(table.records, state.existing);
    const notes = [];
    if (decoded.converted) notes.push("The file was not UTF-8, so accents were converted from Windows text. Check names like Café in the preview.");
    if (table.ignored.length > 0) notes.push("Ignored columns: " + table.ignored.join(", ") + ".");
    setStatus(notes.join(" "));
    review.hidden = false;
    renderAll();
}

async function start() {
    document.getElementById("template-button").addEventListener("click", () => {
        const blob = new Blob(["﻿" + toCsv(templateRows())], { type: "text/csv" });
        const link = el("a", { href: URL.createObjectURL(blob), download: "places-template.csv" });
        document.body.append(link);
        link.click();
        link.remove();
    });
    fileInput.disabled = true;
    setStatus("Loading current places...");
    try {
        const places = await listPlaces();
        state.existing = new Set(places.map((p) => nameKey(p.name)));
        fileInput.disabled = false;
        setStatus(places.length + " places are in the database right now.");
    } catch (error) {
        setStatus(error.message + " Reload the page to try again.", true);
        return;
    }
    fileInput.addEventListener("change", () => handleFile(fileInput.files[0]));
    document.querySelectorAll("input[name='mode']").forEach((radio) => radio.addEventListener("change", renderButton));
    problemsOnly.addEventListener("change", renderTable);
    importButton.addEventListener("click", runImport);
    resetButton.addEventListener("click", reset);
}

if (hasValidSession()) start();
