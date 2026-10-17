const API_BASE = "https://thapar-nav.onrender.com/api/locations";
const ACCOMMODATION_CATEGORIES = ["Hostels", "Faculty Residence", "Guest Accommodation"];
const COORDINATE_PATTERN = /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/;
const EDIT_ICON = "../assets/admin-panel/campus-data/edit.svg";
const DELETE_ICON = "../assets/admin-panel/campus-data/delete.svg";
const JSON_HEADERS = { "Content-Type": "application/json" };

const form = document.getElementById("add-location-form");
const categoryInput = document.getElementById("loc-category");
const addButtons = document.querySelectorAll(".add-new-buttons");
const tableBody = document.getElementById("table-body");
const searchInput = document.getElementById("search");
const sortButtons = document.querySelectorAll(".sort-buttons");

let allLocations = [];
let activeCategory = null;
let searchText = "";

function createElement(tag, options = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(options).forEach(([key, value]) => {
        if (key === "text") {
            node.textContent = value;
        } else if (key === "dataset") {
            Object.assign(node.dataset, value);
        } else {
            node[key] = value;
        }
    });
    children.forEach(child => node.appendChild(child));
    return node;
}

async function request(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
        let message = `Request failed (${response.status})`;
        try {
            const body = await response.json();
            if (body.details) {
                message = Object.values(body.details).join(", ");
            } else if (body.message) {
                message = body.message;
            }
        } catch {
        }
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }
    return response.status === 204 ? null : response.json();
}

function showMessage(text, withRetry = false) {
    tableBody.innerHTML = "";
    const cell = createElement("td", { colSpan: 5, className: "table-message", text });
    if (withRetry) {
        const retryButton = createElement("button", { type: "button", className: "retry-btn", text: "Retry" });
        retryButton.addEventListener("click", loadTableData);
        cell.append(" ", retryButton);
    }
    tableBody.appendChild(createElement("tr", {}, [cell]));
}

async function loadTableData() {
    showMessage("Loading accommodations...");
    try {
        const query = encodeURIComponent(ACCOMMODATION_CATEGORIES.join(","));
        allLocations = await request(`${API_BASE}/filter?categories=${query}`);
        renderTable();
    } catch (error) {
        console.error("Load error:", error);
        showMessage("Could not load accommodations. The server may be waking up, try again in a moment.", true);
    }
}

function visibleLocations() {
    return allLocations.filter(loc => {
        const matchesCategory = !activeCategory || loc.category === activeCategory;
        const matchesSearch = !searchText
            || (loc.title || "").toLowerCase().includes(searchText)
            || String(loc.placeId ?? "").includes(searchText);
        return matchesCategory && matchesSearch;
    });
}

function renderTable() {
    const rows = visibleLocations();
    if (rows.length === 0) {
        showMessage(allLocations.length === 0 ? "No accommodations found." : "No accommodations match your filters.");
        return;
    }
    tableBody.innerHTML = "";
    rows.forEach(loc => tableBody.appendChild(buildRow(loc)));
}

function buildRow(loc) {
    const categorySelect = createElement("select", { className: "cell-input category-select", disabled: true });
    ACCOMMODATION_CATEGORIES.forEach(name => {
        categorySelect.appendChild(createElement("option", { value: name, text: name }));
    });
    categorySelect.value = loc.category;

    const titleInput = createElement("input", {
        type: "text",
        className: "cell-input title-input",
        value: loc.title ?? "",
        disabled: true
    });

    const coordinatesInput = createElement("input", {
        type: "text",
        className: "cell-input coordinates-input",
        value: loc.coordinates ?? "",
        placeholder: "Lat, Long",
        disabled: true
    });

    const mapLink = createElement("a", {
        className: "map-link",
        href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.coordinates ?? "")}`,
        target: "_blank",
        rel: "noopener",
        text: "Map"
    });

    const viewActions = createElement("div", { className: "view-actions" }, [
        createElement("img", { src: EDIT_ICON, alt: "Edit", title: "Edit", className: "action-icon edit-icon", dataset: { action: "edit" } }),
        createElement("img", { src: DELETE_ICON, alt: "Delete", title: "Delete", className: "action-icon delete-icon", dataset: { action: "delete" } })
    ]);

    const editActions = createElement("div", { className: "edit-actions" }, [
        createElement("button", { type: "button", className: "row-btn save-btn", text: "Save", dataset: { action: "save" } }),
        createElement("button", { type: "button", className: "row-btn cancel-btn", text: "Cancel", dataset: { action: "cancel" } })
    ]);

    return createElement("tr", { dataset: { id: loc.id } }, [
        createElement("td", { text: String(loc.placeId ?? "-") }),
        createElement("td", {}, [categorySelect]),
        createElement("td", {}, [titleInput]),
        createElement("td", {}, [createElement("div", { className: "coordinates-wrap" }, [coordinatesInput, mapLink])]),
        createElement("td", { className: "alter-data-cell" }, [viewActions, editActions])
    ]);
}

function setEditing(row, editing) {
    row.classList.toggle("editing", editing);
    row.querySelectorAll(".cell-input").forEach(input => {
        input.disabled = !editing;
    });
}

function startEdit(row) {
    const otherRow = tableBody.querySelector("tr.editing");
    if (otherRow && otherRow !== row) {
        cancelEdit(otherRow);
    }
    setEditing(row, true);
    const titleInput = row.querySelector(".title-input");
    titleInput.focus();
    titleInput.select();
}

function cancelEdit(row) {
    const original = allLocations.find(loc => loc.id === row.dataset.id);
    if (original) {
        row.replaceWith(buildRow(original));
    } else {
        renderTable();
    }
}

function rejectInput(row, selector, message) {
    alert(message);
    row.querySelector(selector).focus();
}

async function saveEdit(row) {
    const title = row.querySelector(".title-input").value.trim();
    const category = row.querySelector(".category-select").value;
    const coordinates = row.querySelector(".coordinates-input").value.trim();

    if (!title) {
        rejectInput(row, ".title-input", "Title cannot be empty.");
        return;
    }
    if (!COORDINATE_PATTERN.test(coordinates)) {
        rejectInput(row, ".coordinates-input", "Coordinates must look like 30.3533, 76.3611");
        return;
    }

    const saveButton = row.querySelector(".save-btn");
    saveButton.disabled = true;

    try {
        const updated = await request(`${API_BASE}/${encodeURIComponent(row.dataset.id)}`, {
            method: "PUT",
            headers: JSON_HEADERS,
            body: JSON.stringify({ title, category, coordinates })
        });
        allLocations = allLocations.map(loc => (loc.id === updated.id ? updated : loc));
        renderTable();
    } catch (error) {
        console.error("Update error:", error);
        saveButton.disabled = false;
        if (error.status === 404) {
            alert("This location no longer exists. Reloading the list.");
            loadTableData();
        } else {
            alert(`Could not save changes: ${error.message}`);
        }
    }
}

async function deleteRow(row) {
    const location = allLocations.find(loc => loc.id === row.dataset.id);
    const name = location ? location.title : "this location";
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) {
        return;
    }

    row.classList.add("deleting");
    try {
        await request(`${API_BASE}/${encodeURIComponent(row.dataset.id)}`, { method: "DELETE" });
    } catch (error) {
        if (error.status !== 404) {
            console.error("Delete error:", error);
            row.classList.remove("deleting");
            alert(`Could not delete: ${error.message}`);
            return;
        }
    }
    allLocations = allLocations.filter(loc => loc.id !== row.dataset.id);
    renderTable();
}

tableBody.addEventListener("click", event => {
    const trigger = event.target.closest("[data-action]");
    if (!trigger) {
        return;
    }
    const row = trigger.closest("tr");
    switch (trigger.dataset.action) {
        case "edit":
            startEdit(row);
            break;
        case "save":
            saveEdit(row);
            break;
        case "cancel":
            cancelEdit(row);
            break;
        case "delete":
            deleteRow(row);
            break;
    }
});

tableBody.addEventListener("keydown", event => {
    const row = event.target.closest("tr.editing");
    if (!row) {
        return;
    }
    if (event.key === "Enter") {
        event.preventDefault();
        saveEdit(row);
    } else if (event.key === "Escape") {
        cancelEdit(row);
    }
});

addButtons.forEach(button => {
    button.addEventListener("click", event => {
        form.classList.add("expanded");
        addButtons.forEach(btn => btn.classList.remove("active-category"));
        event.target.classList.add("active-category");
        categoryInput.value = event.target.getAttribute("data-category");
    });
});

sortButtons.forEach(button => {
    button.addEventListener("click", () => {
        const wasActive = button.classList.contains("active-sort");
        sortButtons.forEach(btn => btn.classList.remove("active-sort"));
        activeCategory = wasActive ? null : button.textContent.trim();
        if (!wasActive) {
            button.classList.add("active-sort");
        }
        renderTable();
    });
});

searchInput.addEventListener("input", () => {
    searchText = searchInput.value.trim().toLowerCase();
    renderTable();
});

form.addEventListener("submit", async event => {
    event.preventDefault();

    const title = document.getElementById("loc-title").value.trim();
    const category = categoryInput.value;
    const coordinates = document.getElementById("loc-coordinates").value.trim();

    if (!ACCOMMODATION_CATEGORIES.includes(category)) {
        alert("Choose a category with one of the Add new buttons first.");
        return;
    }
    if (!title) {
        alert("Title cannot be empty.");
        return;
    }
    if (!COORDINATE_PATTERN.test(coordinates)) {
        alert("Coordinates must look like 30.3533, 76.3611");
        return;
    }

    const submitButton = document.getElementById("save-location-btn");
    submitButton.disabled = true;

    try {
        await request(API_BASE, {
            method: "POST",
            headers: JSON_HEADERS,
            body: JSON.stringify({ title, category, coordinates })
        });
        form.reset();
        form.classList.remove("expanded");
        addButtons.forEach(btn => btn.classList.remove("active-category"));
        await loadTableData();
    } catch (error) {
        console.error("Save error:", error);
        alert(`Could not save: ${error.message}`);
    } finally {
        submitButton.disabled = false;
    }
});

loadTableData();
