import { listEditHistory } from "./api.js";

const historyCard = document.getElementById("history-card");
const PAGE_LIMIT = (historyCard && Number(historyCard.dataset.limit)) || 25;
const ACTION_LABELS = { created: "Added", updated: "Changed", deleted: "Deleted" };
const ENTITY_LABELS = { place: "Place", walkway: "Walkway", junction: "Junction" };

const body = document.getElementById("history-body");
const statusLine = document.getElementById("status-line");
const moreButton = document.getElementById("more-button");
const searchInput = document.getElementById("search-input");
const actionFilter = document.getElementById("action-filter");
const tabs = Array.from(document.querySelectorAll(".tab"));

const state = { entity: "", action: "", q: "", page: 1, total: 0, shown: 0, token: 0 };

function cell(text, className) {
    const td = document.createElement("td");
    td.textContent = text;
    if (className) td.className = className;
    return td;
}

function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function detailsCell(entry) {
    const td = document.createElement("td");
    td.className = "details";
    if (entry.changes && entry.changes.length) {
        for (const change of entry.changes) {
            const line = document.createElement("p");
            line.textContent = change.field + ": " + change.from + " \u2192 " + change.to;
            td.append(line);
        }
    } else {
        td.textContent = entry.summary || "";
    }
    return td;
}

function addRow(entry) {
    const row = document.createElement("tr");
    const actionCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "badge badge-" + entry.action;
    badge.textContent = ACTION_LABELS[entry.action] || entry.action;
    actionCell.append(badge);
    const what = (ENTITY_LABELS[entry.entity] || entry.entity) + ": " + (entry.entityName || "(unnamed)");
    row.append(cell(formatDate(entry.createdAt), "muted nowrap"), cell(entry.adminName), actionCell, cell(what), detailsCell(entry));
    body.append(row);
}

async function load(reset) {
    if (reset) {
        state.page = 1;
        state.shown = 0;
        body.textContent = "";
    }
    const token = ++state.token;
    statusLine.textContent = "Loading...";
    moreButton.hidden = true;
    try {
        const data = await listEditHistory({ entity: state.entity, action: state.action, q: state.q, page: state.page, limit: PAGE_LIMIT });
        if (token !== state.token) return;
        state.total = data.total;
        for (const entry of data.entries) addRow(entry);
        state.shown += data.entries.length;
        statusLine.textContent = state.total === 0 ? "No edits recorded yet." : "Showing " + state.shown + " of " + state.total;
        moreButton.hidden = state.shown >= state.total;
    } catch (error) {
        if (token !== state.token) return;
        statusLine.textContent = "Could not load edit history: " + error.message;
    }
}

for (const tab of tabs) {
    tab.addEventListener("click", () => {
        state.entity = tab.dataset.entity;
        for (const other of tabs) other.setAttribute("aria-pressed", String(other === tab));
        load(true);
    });
}

actionFilter.addEventListener("change", () => {
    state.action = actionFilter.value;
    load(true);
});

let timer = null;
searchInput.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
        state.q = searchInput.value.trim();
        load(true);
    }, 300);
});

moreButton.addEventListener("click", () => {
    state.page += 1;
    load(false);
});

document.addEventListener("shell-ready", () => load(true));

let refreshTimer = null;
document.addEventListener("data-edited", () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => load(true), 800);
});
