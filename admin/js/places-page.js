import { hasValidSession } from "./auth.js";

import { el, clear, toast } from "./dom.js";
import { CATEGORIES, ROLES, CAMPUS_BOUNDS } from "./config.js";
import { listPlaces, createPlace, updatePlace, deletePlace, uploadPlacePhoto, deletePlacePhoto, placePhotoUrl } from "./api.js";
import { preparePhoto } from "./photo.js";

const body = document.getElementById("places-body");
const statusLine = document.getElementById("status-line");
const searchInput = document.getElementById("search-input");
const categoryFilter = document.getElementById("category-filter");
const addButton = document.getElementById("add-button");
const dialog = document.getElementById("confirm-dialog");
const confirmText = document.getElementById("confirm-text");

const state = { places: [], loaded: false, editing: null };

function sortPlaces() {
    state.places.sort((a, b) => a.name.localeCompare(b.name));
}

function matches(place) {
    const category = categoryFilter.value;
    if (category && place.category !== category) return false;
    const text = searchInput.value.trim().toLowerCase();
    if (!text) return true;
    const haystack = [place.name, place.description || "", ...(place.aliases || [])].join(" ").toLowerCase();
    return text.split(/\s+/).every((word) => haystack.includes(word));
}

function setStatus(message, isError) {
    statusLine.textContent = message;
    statusLine.className = isError ? "error" : "";
}

function updateCount(shown) {
    if (!state.loaded) return;
    const total = state.places.length;
    setStatus(shown === total ? total + " places" : "Showing " + shown + " of " + total + " places");
}

function blankPlace() {
    return {
        _id: null,
        name: "",
        category: categoryFilter.value || "other",
        description: "",
        aliases: [],
        lat: "",
        lng: "",
        visibleTo: Object.keys(ROLES),
        openingHours: "",
        isEntrance: false,
        isActive: true
    };
}

function categorySelect(value) {
    const select = el("select", { class: "cell-select", "aria-label": "Category", disabled: true });
    for (const [key, label] of Object.entries(CATEGORIES)) {
        select.append(el("option", { value: key, text: label }));
    }
    select.value = value;
    return select;
}

function textInput(value, label, extra = {}) {
    const input = el("input", { class: "cell-input", type: "text", "aria-label": label, disabled: true, ...extra });
    input.value = value;
    return input;
}

function checkbox(label, checked, extra = {}) {
    const input = el("input", { type: "checkbox", disabled: true, ...extra });
    input.checked = checked;
    return { input, wrap: el("label", { class: "check" }, [input, label]) };
}

function iconButton(label, icon, onClick) {
    return el("button", { type: "button", class: "icon-btn", title: label, "aria-label": label, onclick: onClick }, [
        el("img", { alt: "", src: "./assets/admin-panel/campus-data/" + icon })
    ]);
}

function buildRow(place, startEditing) {
    const isNew = place._id === null;
    const nameInput = textInput(place.name, "Name", { maxlength: "120" });
    const category = categorySelect(place.category);
    const lat = textInput(place.lat, "Latitude", { inputmode: "decimal" });
    const lng = textInput(place.lng, "Longitude", { inputmode: "decimal" });
    lat.classList.add("num");
    lng.classList.add("num");
    const roleBoxes = Object.entries(ROLES).map(([key, label]) => {
        const box = checkbox(label, place.visibleTo.includes(key));
        return { key, ...box };
    });
    const active = checkbox("Active", place.isActive);
    const description = textInput(place.description || "", "Description", { maxlength: "1000" });
    const aliases = textInput((place.aliases || []).join(", "), "Other names", { maxlength: "400" });
    const hasAliases = (place.aliases || []).length > 0;
    const aliasToggle = checkbox("Add other names", hasAliases);
    const aliasLabel = el("label", { hidden: !hasAliases }, ["Other names (comma separated)", aliases]);
    aliasToggle.input.addEventListener("change", () => {
        aliasLabel.hidden = !aliasToggle.input.checked;
        if (aliasToggle.input.checked && !aliases.disabled) aliases.focus();
    });
    const hours = textInput(place.openingHours || "", "Opening hours", { maxlength: "120" });
    const entrance = checkbox("Entrance", Boolean(place.isEntrance));
    const errorBox = el("p", { class: "row-error", role: "alert", hidden: true });

    const photo = { blob: null, remove: false, objectUrl: null };
    const photoInput = el("input", { class: "photo-input", type: "file", accept: "image/jpeg,image/png,image/webp", "aria-label": "Photo of the location", disabled: true });
    const photoPreview = el("img", { class: "photo-preview", alt: "Photo of " + (place.name || "the location"), hidden: true });
    const photoRemove = el("button", { type: "button", class: "plain small-btn", text: "Remove photo", disabled: true, hidden: true });
    const photoNote = el("p", { class: "photo-note", text: "JPEG, PNG or WebP. Big photos are shrunk automatically." });
    const hadPhoto = Boolean(place.hasPhoto);

    function releasePreview() {
        if (photo.objectUrl) {
            URL.revokeObjectURL(photo.objectUrl);
            photo.objectUrl = null;
        }
    }

    function refreshPhoto() {
        let source = "";
        if (photo.blob) source = photo.objectUrl;
        else if (hadPhoto && !photo.remove) source = placePhotoUrl(place);
        photoPreview.hidden = !source;
        if (source) photoPreview.src = source;
        else photoPreview.removeAttribute("src");
        photoRemove.hidden = !source;
    }

    photoInput.addEventListener("change", async () => {
        const file = photoInput.files && photoInput.files[0];
        if (!file) return;
        photoNote.textContent = "Preparing photo...";
        try {
            const blob = await preparePhoto(file);
            releasePreview();
            photo.blob = blob;
            photo.remove = false;
            photo.objectUrl = URL.createObjectURL(blob);
            photoNote.textContent = "Photo ready (" + Math.round(blob.size / 1024) + " KB). It uploads when you click Save.";
            errorBox.hidden = true;
        } catch (error) {
            photoInput.value = "";
            photoNote.textContent = "JPEG, PNG or WebP. Big photos are shrunk automatically.";
            showError(error.message);
        }
        refreshPhoto();
    });

    photoRemove.addEventListener("click", () => {
        releasePreview();
        photo.blob = null;
        photo.remove = hadPhoto;
        photoInput.value = "";
        photoNote.textContent = hadPhoto ? "The photo will be removed when you click Save." : "JPEG, PNG or WebP. Big photos are shrunk automatically.";
        refreshPhoto();
    });

    const fields = [nameInput, category, lat, lng, description, aliasToggle.input, aliases, hours, photoInput, photoRemove, ...roleBoxes.map((r) => r.input), active.input, entrance.input];

    const actions = el("div", { class: "actions" });
    const detailCell = el("td", { colspan: "7" });
    const nameView = el("span", { class: "view-text", text: place.name || "" });
    const categoryView = el("span", { class: "view-text", text: CATEGORIES[place.category] || place.category || "" });
    const nameCell = el("div", { class: "name-cell" }, [
        place.hasPhoto ? el("img", { class: "name-thumb", alt: "", loading: "lazy", src: placePhotoUrl(place) }) : null,
        nameInput,
        nameView
    ]);
    const main = el("tr", { class: isNew ? "row-new" : "", dataset: isNew ? {} : { placeName: place.name } }, [
        el("td", {}, [nameCell]),
        el("td", {}, [category, categoryView]),
        el("td", {}, [lat]),
        el("td", {}, [lng]),
        el("td", {}, [el("div", { class: "roles" }, roleBoxes.map((r) => r.wrap))]),
        el("td", {}, [active.wrap]),
        el("td", {}, [actions])
    ]);
    const detail = el("tr", { class: "detail", hidden: true }, [detailCell]);
    detailCell.append(
        el("div", { class: "detail-grid" }, [
            el("label", {}, ["Description", description]),
            aliasToggle.wrap,
            aliasLabel,
            el("label", {}, ["Opening hours", hours]),
            entrance.wrap
        ]),
        el("div", { class: "photo-field" }, [
            el("span", { class: "photo-label", text: "Photo of the location" }),
            el("div", { class: "photo-controls" }, [photoPreview, el("div", { class: "photo-actions" }, [photoInput, photoRemove, photoNote])])
        ]),
        errorBox
    );

    let saveButton = null;
    let cancelButton = null;
    let editButton = null;
    let deleteButton = null;

    function showError(message, details) {
        errorBox.textContent = "";
        errorBox.append(message);
        if (details && details.length > 1) {
            for (const item of details) errorBox.append(el("br"), "• " + item.message);
        }
        errorBox.hidden = false;
    }

    function setEditing(on) {
        for (const field of fields) field.disabled = !on;
        nameInput.hidden = !on;
        category.hidden = !on;
        nameView.hidden = on;
        categoryView.hidden = on;
        detail.hidden = !on;
        main.classList.toggle("row-editing", on && !isNew);
        errorBox.hidden = true;
        clear(actions);
        if (on) actions.append(saveButton, cancelButton);
        else actions.append(editButton, deleteButton);
        if (on) {
            refreshPhoto();
            nameInput.focus();
        } else {
            releasePreview();
        }
    }

    function collect() {
        const name = nameInput.value.trim();
        const latValue = Number(lat.value.trim());
        const lngValue = Number(lng.value.trim());
        if (name.length < 2 || name.length > 120) return { error: "Name must be 2 to 120 characters." };
        if (lat.value.trim() === "" || !Number.isFinite(latValue)) return { error: "Latitude must be a number." };
        if (lng.value.trim() === "" || !Number.isFinite(lngValue)) return { error: "Longitude must be a number." };
        if (latValue < CAMPUS_BOUNDS.minLat || latValue > CAMPUS_BOUNDS.maxLat) {
            return { error: "Latitude must be between " + CAMPUS_BOUNDS.minLat + " and " + CAMPUS_BOUNDS.maxLat + " (campus area)." };
        }
        if (lngValue < CAMPUS_BOUNDS.minLng || lngValue > CAMPUS_BOUNDS.maxLng) {
            return { error: "Longitude must be between " + CAMPUS_BOUNDS.minLng + " and " + CAMPUS_BOUNDS.maxLng + " (campus area)." };
        }
        const visibleTo = roleBoxes.filter((r) => r.input.checked).map((r) => r.key);
        if (visibleTo.length === 0) return { error: "Pick at least one group that can see this place." };
        const aliasList = !aliasToggle.input.checked ? [] : aliases.value.split(",").map((a) => a.trim()).filter(Boolean);
        if (aliasList.length > 10) return { error: "Use at most 10 other names." };
        if (aliasList.some((a) => a.length > 80)) return { error: "Each other name must be 80 characters or fewer." };
        return {
            data: {
                name,
                category: category.value,
                description: description.value.trim(),
                aliases: aliasList,
                lat: latValue,
                lng: lngValue,
                visibleTo,
                openingHours: hours.value.trim(),
                isEntrance: entrance.input.checked,
                isActive: active.input.checked
            }
        };
    }

    async function save() {
        const result = collect();
        if (result.error) {
            showError(result.error);
            return;
        }
        errorBox.hidden = true;
        saveButton.disabled = true;
        cancelButton.disabled = true;
        saveButton.textContent = "Saving...";
        try {
            const response = isNew ? await createPlace(result.data) : await updatePlace(place._id, result.data);
            let saved = response.place;
            let photoProblem = "";
            if (photo.blob) {
                try {
                    saved = (await uploadPlacePhoto(saved._id, photo.blob)).place;
                } catch (error) {
                    photoProblem = error.message;
                }
            } else if (photo.remove && saved.hasPhoto) {
                try {
                    saved = (await deletePlacePhoto(saved._id)).place;
                } catch (error) {
                    photoProblem = error.message;
                }
            }
            releasePreview();
            if (isNew) {
                state.places.push(saved);
            } else {
                const index = state.places.findIndex((p) => p._id === saved._id);
                if (index >= 0) state.places[index] = saved;
            }
            state.editing = null;
            sortPlaces();
            render();
            if (photoProblem) toast((isNew ? "Place added" : "Place saved") + ", but the photo failed: " + photoProblem, "error");
            else toast(isNew ? "Place added." : "Place saved.");
        } catch (error) {
            saveButton.disabled = false;
            cancelButton.disabled = false;
            saveButton.textContent = "Save";
            showError(error.message, error.details);
        }
    }

    function cancel() {
        state.editing = null;
        render();
    }

    async function remove() {
        confirmText.textContent = 'Delete "' + place.name + '"? This cannot be undone.';
        const answer = await askConfirm();
        if (!answer) return;
        deleteButton.disabled = true;
        try {
            await deletePlace(place._id);
            state.places = state.places.filter((p) => p._id !== place._id);
            render();
            toast("Place deleted.");
        } catch (error) {
            deleteButton.disabled = false;
            toast(error.message, "error");
        }
    }

    saveButton = el("button", { type: "button", class: "primary small-btn", text: "Save", onclick: save });
    cancelButton = el("button", { type: "button", class: "plain small-btn", text: "Cancel", onclick: cancel });
    editButton = iconButton("Edit " + place.name, "edit.svg", () => {
        if (state.editing && state.editing !== place._id) {
            toast("Save or cancel the row you are editing first.", "error");
            return;
        }
        state.editing = place._id;
        setEditing(true);
    });
    deleteButton = iconButton("Delete " + place.name, "delete.svg", remove);

    for (const field of [nameInput, lat, lng, description, aliases, hours]) {
        field.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !field.disabled) {
                event.preventDefault();
                save();
            } else if (event.key === "Escape" && !field.disabled) {
                cancel();
            }
        });
    }

    setEditing(Boolean(startEditing));
    return [main, detail];
}

function askConfirm() {
    return new Promise((resolve) => {
        dialog.addEventListener("close", () => resolve(dialog.returnValue === "yes"), { once: true });
        dialog.returnValue = "cancel";
        dialog.showModal();
    });
}

function render() {
    clear(body);
    if (state.editing === "new") {
        body.append(...buildRow(blankPlace(), true));
    }
    const visible = state.places.filter((p) => matches(p) || p._id === state.editing);
    for (const place of visible) {
        body.append(...buildRow(place, place._id === state.editing));
    }
    if (visible.length === 0 && state.editing !== "new") {
        const message = state.places.length === 0
            ? "No places yet. Click \"Add place\" to create the first one."
            : "No places match your search.";
        body.append(el("tr", {}, [el("td", { colspan: "7", class: "empty-cell", text: message })]));
    }
    updateCount(visible.length);
}

function startAdd() {
    if (state.editing) {
        toast("Save or cancel the row you are editing first.", "error");
        return;
    }
    state.editing = "new";
    render();
    const firstInput = body.querySelector("tr.row-new input");
    if (firstInput) firstInput.focus();
}

async function load() {
    setStatus("Loading places...");
    addButton.disabled = true;
    try {
        state.places = await listPlaces();
        state.loaded = true;
        sortPlaces();
        addButton.disabled = false;
        render();
    } catch (error) {
        setStatus(error.message, true);
        body.append(
            el("tr", {}, [
                el("td", { colspan: "7", class: "empty-cell" }, [
                    el("button", { type: "button", class: "primary", text: "Try again", onclick: () => {
                        clear(body);
                        load();
                    } })
                ])
            ])
        );
    }
}

function start() {
    categoryFilter.append(el("option", { value: "", text: "All categories" }));
    for (const [key, label] of Object.entries(CATEGORIES)) {
        categoryFilter.append(el("option", { value: key, text: label }));
    }
    const wanted = new URLSearchParams(window.location.search).get("category");
    if (wanted && CATEGORIES[wanted]) categoryFilter.value = wanted;
    searchInput.addEventListener("input", () => state.loaded && render());
    categoryFilter.addEventListener("change", () => state.loaded && render());
    addButton.addEventListener("click", startAdd);
    load();
}

if (hasValidSession()) start();
