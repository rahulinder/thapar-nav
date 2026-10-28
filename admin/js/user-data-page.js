import { call } from "./api.js";

const PAGE_LIMIT = 25;
const TYPE_LABELS = { student: "Student", staff: "Teacher", visitor: "Visitor" };

const body = document.getElementById("users-body");
const statusLine = document.getElementById("status-line");
const moreButton = document.getElementById("more-button");
const searchInput = document.getElementById("search-input");
const typeFilter = document.getElementById("usertype-filter");
const tabs = Array.from(document.querySelectorAll(".tab"));

const state = { type: "all", userType: "", q: "", page: 1, total: 0, shown: 0, token: 0 };

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

function addRow(client) {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    if (client.isGuest) {
        const badge = document.createElement("span");
        badge.className = "badge badge-guest";
        badge.textContent = "Guest";
        nameCell.append(badge);
    } else {
        nameCell.textContent = client.name || "";
    }
    const actionCell = document.createElement("td");
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => removeUser(client, removeButton));
    actionCell.append(removeButton);
    row.append(nameCell, cell(client.rollNo || client.contact || "-", "muted"), cell(TYPE_LABELS[client.userType] || client.userType), cell(formatDate(client.createdAt), "muted"), actionCell);
    body.append(row);
}

function setCounts(totals) {
    const registered = (totals && totals.registered) || 0;
    const guests = (totals && totals.guests) || 0;
    document.getElementById("count-all").textContent = registered + guests;
    document.getElementById("count-registered").textContent = registered;
    document.getElementById("count-guest").textContent = guests;
}

async function removeUser(client, button) {
    const label = client.isGuest ? "this guest" : client.name || "this user";
    if (!window.confirm("Remove " + label + " from the platform? This cannot be undone.")) return;
    button.disabled = true;
    try {
        await call("/clients/" + client._id, { method: "DELETE" });
        await load(true);
    } catch (error) {
        button.disabled = false;
        statusLine.textContent = "Could not remove user: " + error.message;
    }
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
    const params = new URLSearchParams({ type: state.type, page: String(state.page), limit: String(PAGE_LIMIT) });
    if (state.userType) params.set("userType", state.userType);
    if (state.q) params.set("q", state.q);
    try {
        const data = await call("/clients?" + params.toString());
        if (token !== state.token) return;
        setCounts(data.totals);
        state.total = data.total;
        for (const client of data.clients) addRow(client);
        state.shown += data.clients.length;
        statusLine.textContent = state.total === 0 ? "No users found." : "Showing " + state.shown + " of " + state.total;
        moreButton.hidden = state.shown >= state.total;
    } catch (error) {
        if (token !== state.token) return;
        statusLine.textContent = "Could not load users: " + error.message;
    }
}

for (const tab of tabs) {
    tab.addEventListener("click", () => {
        state.type = tab.dataset.type;
        for (const other of tabs) other.setAttribute("aria-pressed", String(other === tab));
        load(true);
    });
}

typeFilter.addEventListener("change", () => {
    state.userType = typeFilter.value;
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
