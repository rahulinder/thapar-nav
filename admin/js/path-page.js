import { hasValidSession } from "./auth.js";
import { el, clear, toast, confirmDialog } from "./dom.js";
import { CAMPUS_BOUNDS, CAMPUS_CENTER, MAP_ZOOM, CATEGORIES } from "./config.js";
import {
    getNetwork, listPlaces, createJunction, updateJunction, deleteJunction,
    createWalkway, updateWalkway, deleteWalkway, updatePlace
} from "./api.js";

const HINTS = {
    select: "Click a dot, a line or a place to see its details. Drag a blue dot to move it.",
    junction: "Click anywhere on the map to drop a junction (a point where paths meet or bend).",
    connect: "Click a junction to start a walkway, then click the next junction. Keep clicking to chain walkways. Press Esc to stop."
};

const state = {
    mode: "select",
    junctions: new Map(),
    walkways: new Map(),
    places: new Map(),
    selected: null,
    connectFrom: null,
    busy: false,
    defaults: { bidirectional: true, drivable: false, driveBidirectional: true }
};

let map = null;
let walkLayer = null;
let casingLayer = null;
let arrowLayer = null;
let junctionLayer = null;
let placeLayer = null;

const panel = document.getElementById("panel");
const hint = document.getElementById("hint");

function distance(a, b) {
    const R = 6371000;
    const rad = (d) => (d * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function inBounds(lat, lng) {
    return lat >= CAMPUS_BOUNDS.minLat && lat <= CAMPUS_BOUNDS.maxLat && lng >= CAMPUS_BOUNDS.minLng && lng <= CAMPUS_BOUNDS.maxLng;
}

function setHint(message, isError) {
    hint.textContent = message;
    hint.className = isError ? "error" : "";
}

function junctionLabel(id) {
    const entry = state.junctions.get(id);
    if (!entry) return "(missing)";
    return entry.data.label ? entry.data.label : "Junction " + shortId(id);
}

function shortId(id) {
    return String(id).slice(-4);
}

function degreeMap() {
    const degree = new Map();
    for (const { data } of state.walkways.values()) {
        degree.set(data.from, (degree.get(data.from) || 0) + 1);
        degree.set(data.to, (degree.get(data.to) || 0) + 1);
    }
    return degree;
}

function countParts() {
    const parent = new Map();
    const find = (x) => {
        while (parent.get(x) !== x) {
            parent.set(x, parent.get(parent.get(x)));
            x = parent.get(x);
        }
        return x;
    };
    for (const id of state.junctions.keys()) parent.set(id, id);
    for (const { data } of state.walkways.values()) {
        if (parent.has(data.from) && parent.has(data.to)) parent.set(find(data.from), find(data.to));
    }
    const roots = new Set();
    for (const id of state.junctions.keys()) roots.add(find(id));
    return roots.size;
}

function junctionIcon(classes) {
    return L.divIcon({ className: "", html: '<div class="junction-dot ' + classes + '"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
}

function placeIcon(classes) {
    return L.divIcon({ className: "", html: '<div class="place-dot ' + classes + '"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });
}

function walkStyle(data, selected) {
    return {
        color: selected ? "#ff9500" : "#0071e3",
        weight: selected ? 7 : 5,
        opacity: 0.85,
        dashArray: data.bidirectional === false ? "8 8" : null,
        bubblingMouseEvents: false
    };
}

function bearing(a, b) {
    const p1 = L.CRS.EPSG3857.project(L.latLng(a.lat, a.lng));
    const p2 = L.CRS.EPSG3857.project(L.latLng(b.lat, b.lng));
    return (Math.atan2(-(p2.y - p1.y), p2.x - p1.x) * 180) / Math.PI;
}

function arrowIcon(kind, color, angle) {
    const html = '<svg class="dir-arrow ' + kind + '" viewBox="0 0 16 16" width="18" height="18" style="transform:rotate(' + angle.toFixed(1) + 'deg)"><path d="M2 2l12 6-12 6 3-6z" fill="' + color + '"/></svg>';
    return L.divIcon({ className: "", html, iconSize: [18, 18], iconAnchor: [9, 9] });
}

function pointAt(a, b, t) {
    return [a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t];
}

function decorSignature(data, a, b) {
    return [data.drivable === true, data.driveBidirectional !== false, data.bidirectional !== false, a.lat, a.lng, b.lat, b.lng].join("|");
}

function removeDecor(entry) {
    if (entry.casing) casingLayer.removeLayer(entry.casing);
    for (const arrow of entry.arrows || []) arrowLayer.removeLayer(arrow);
    entry.casing = null;
    entry.arrows = [];
    entry.sig = null;
}

function rebuildDecor(entry) {
    const a = state.junctions.get(entry.data.from);
    const b = state.junctions.get(entry.data.to);
    if (!a || !b) return;
    const sig = decorSignature(entry.data, a.data, b.data);
    if (entry.sig === sig) return;
    removeDecor(entry);
    entry.sig = sig;
    const data = entry.data;
    const latlngs = [[a.data.lat, a.data.lng], [b.data.lat, b.data.lng]];
    const angle = bearing(a.data, b.data);
    if (data.drivable === true) {
        entry.casing = L.polyline(latlngs, { color: "#16a34a", weight: 13, opacity: 0.4, lineCap: "round", interactive: false }).addTo(casingLayer);
    }
    const walkColor = "#0071e3";
    if (data.bidirectional === false) {
        entry.arrows.push(L.marker(pointAt(a.data, b.data, 0.38), { icon: arrowIcon("walk", walkColor, angle), interactive: false, keyboard: false }).addTo(arrowLayer));
    }
    if (data.drivable === true && data.driveBidirectional === false) {
        entry.arrows.push(L.marker(pointAt(a.data, b.data, 0.62), { icon: arrowIcon("drive", "#15803d", angle), interactive: false, keyboard: false }).addTo(arrowLayer));
    }
}

function removeWalkLayers(entry) {
    walkLayer.removeLayer(entry.line);
    removeDecor(entry);
}

function refreshStyles() {
    const degree = degreeMap();
    for (const [id, entry] of state.junctions) {
        const classes = [];
        if (state.selected && state.selected.type === "junction" && state.selected.id === id) classes.push("selected");
        if (state.connectFrom === id) classes.push("from");
        if (!degree.get(id)) classes.push("isolated");
        entry.marker.setIcon(junctionIcon(classes.join(" ")));
    }
    for (const [id, entry] of state.walkways) {
        const selected = state.selected && state.selected.type === "walkway" && state.selected.id === id;
        entry.line.setStyle(walkStyle(entry.data, selected));
        rebuildDecor(entry);
    }
    for (const [id, entry] of state.places) {
        const classes = [];
        if (!entry.data.junction) classes.push("unlinked");
        if (state.selected && state.selected.type === "place" && state.selected.id === id) classes.push("selected");
        entry.marker.setIcon(placeIcon(classes.join(" ")));
    }
}

function select(type, id) {
    state.selected = type ? { type, id } : null;
    refreshStyles();
    renderPanel();
}

function addJunctionToMap(data) {
    const marker = L.marker([data.lat, data.lng], {
        icon: junctionIcon(""),
        draggable: state.mode === "select",
        zIndexOffset: 200,
        title: data.label || ""
    });
    marker.on("click", (event) => {
        L.DomEvent.stopPropagation(event);
        onJunctionClick(data._id);
    });
    marker.on("dragend", () => onJunctionMoved(data._id));
    marker.addTo(junctionLayer);
    state.junctions.set(data._id, { data, marker });
}

function addWalkwayToMap(data) {
    const a = state.junctions.get(data.from);
    const b = state.junctions.get(data.to);
    if (!a || !b) return;
    const line = L.polyline([[a.data.lat, a.data.lng], [b.data.lat, b.data.lng]], walkStyle(data, false));
    line.on("click", (event) => {
        L.DomEvent.stopPropagation(event);
        if (state.mode === "select") select("walkway", data._id);
    });
    line.addTo(walkLayer);
    const entry = { data, line, casing: null, arrows: [], sig: null };
    state.walkways.set(data._id, entry);
    rebuildDecor(entry);
}

function addPlaceToMap(data) {
    const marker = L.marker([data.lat, data.lng], { icon: placeIcon(""), zIndexOffset: 100, title: data.name });
    marker.on("click", (event) => {
        L.DomEvent.stopPropagation(event);
        if (state.mode === "select") select("place", data._id);
    });
    marker.addTo(placeLayer);
    data.junction = data.junction ? String(data.junction) : null;
    state.places.set(data._id, { data, marker });
}

function redrawWalkwaysOf(junctionId) {
    for (const entry of state.walkways.values()) {
        if (entry.data.from === junctionId || entry.data.to === junctionId) {
            const a = state.junctions.get(entry.data.from).data;
            const b = state.junctions.get(entry.data.to).data;
            entry.line.setLatLngs([[a.lat, a.lng], [b.lat, b.lng]]);
            entry.data.distanceMeters = Math.round(distance(a, b) * 10) / 10;
        }
    }
}

async function onJunctionMoved(id) {
    const entry = state.junctions.get(id);
    const spot = entry.marker.getLatLng();
    const old = { lat: entry.data.lat, lng: entry.data.lng };
    if (!inBounds(spot.lat, spot.lng)) {
        entry.marker.setLatLng([old.lat, old.lng]);
        toast("That spot is outside the campus area.", "error");
        return;
    }
    try {
        const response = await updateJunction(id, { label: entry.data.label || "", lat: spot.lat, lng: spot.lng });
        entry.data = { ...entry.data, ...response.junction };
        redrawWalkwaysOf(id);
        if (state.selected && state.selected.id === id) renderPanel();
        toast("Junction moved.");
    } catch (error) {
        entry.marker.setLatLng([old.lat, old.lng]);
        toast(error.message, "error");
    }
}

async function onJunctionClick(id) {
    if (state.mode === "select") {
        select("junction", id);
        return;
    }
    if (state.mode !== "connect" || state.busy) return;
    if (!state.connectFrom) {
        state.connectFrom = id;
        setHint("Starting at " + junctionLabel(id) + ". Now click the junction it should connect to.");
        refreshStyles();
        return;
    }
    if (state.connectFrom === id) {
        state.connectFrom = null;
        setHint(HINTS.connect);
        refreshStyles();
        return;
    }
    state.busy = true;
    try {
        const response = await createWalkway({ from: state.connectFrom, to: id, ...state.defaults });
        addWalkwayToMap(response.walkway);
        state.connectFrom = id;
        setHint("Walkway added. Click the next junction to continue, or press Esc to stop.");
        toast("Walkway added.");
    } catch (error) {
        setHint(error.message, true);
        toast(error.message, "error");
    } finally {
        state.busy = false;
        refreshStyles();
        renderPanel();
    }
}

async function onMapClick(event) {
    if (state.mode === "junction") {
        if (state.busy) return;
        const { lat, lng } = event.latlng;
        if (!inBounds(lat, lng)) {
            toast("That spot is outside the campus area.", "error");
            return;
        }
        state.busy = true;
        try {
            const response = await createJunction({ lat, lng });
            addJunctionToMap(response.junction);
            toast("Junction added.");
            refreshStyles();
            renderPanel();
        } catch (error) {
            toast(error.message, "error");
        } finally {
            state.busy = false;
        }
        return;
    }
    if (state.mode === "select") select(null);
}

function setMode(mode) {
    state.mode = mode;
    state.connectFrom = null;
    document.querySelectorAll("#modes .mode").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
    document.getElementById("map").classList.toggle("mode-junction", mode === "junction");
    for (const entry of state.junctions.values()) {
        if (mode === "select") entry.marker.dragging.enable();
        else entry.marker.dragging.disable();
    }
    if (mode !== "select") state.selected = null;
    setHint(HINTS[mode]);
    refreshStyles();
    renderPanel();
}

function field(labelText, input) {
    return el("label", { class: "field" }, [labelText, input]);
}

function errorBox(message) {
    return el("p", { class: "panel-error", role: "alert", text: message });
}

function renderOverview() {
    const degree = degreeMap();
    const isolated = [...state.junctions.keys()].filter((id) => !degree.get(id));
    const unlinked = [...state.places.values()].filter((p) => !p.data.junction);
    const parts = countParts();
    const nodes = [
        el("h3", { text: "Walking network" }),
        el("p", { text: state.junctions.size + " junctions, " + state.walkways.size + " walkways, " + state.places.size + " places." })
    ];
    if (state.junctions.size === 0) {
        nodes.push(el("p", { class: "muted", text: "Start with \"Add junction\": drop dots at gates, corners and building entrances. Then use \"Draw walkway\" to join them." }));
    }
    if (parts > 1) nodes.push(el("p", { class: "warn", text: "The network has " + parts + " separate parts. Routes only work between places in the same part, so join them with a walkway." }));
    if (isolated.length > 0) nodes.push(el("p", { class: "warn", text: isolated.length + " junction(s) have no walkway (shown red)." }));
    if (unlinked.length > 0) {
        nodes.push(el("p", { class: "warn", text: unlinked.length + " place(s) are not linked to a junction (orange squares). Routes can't reach them." }));
        const list = el("ul", { class: "mini-list" });
        for (const entry of unlinked.slice(0, 8)) {
            list.append(el("li", {}, [el("a", { href: "#", text: entry.data.name, onclick: (event) => {
                event.preventDefault();
                if (state.mode !== "select") setMode("select");
                map.panTo([entry.data.lat, entry.data.lng]);
                select("place", entry.data._id);
            } })]));
        }
        nodes.push(list);
        if (unlinked.length > 8) nodes.push(el("p", { class: "muted", text: "...and " + (unlinked.length - 8) + " more." }));
    }
    if (state.junctions.size > 0 && parts === 1 && isolated.length === 0 && unlinked.length === 0 && state.places.size > 0) {
        nodes.push(el("p", { class: "good", text: "Everything is connected. Routing should work." }));
    }
    nodes.push(el("p", { class: "muted", text: "Blue line: two-way walkway. Dashed: one-way. Green glow: drivable. Arrows show one-way direction (blue: walking, green: driving). Purple squares: places linked to a junction." }));
    return nodes;
}

function renderJunctionPanel(id) {
    const entry = state.junctions.get(id);
    const data = entry.data;
    const linkedPlaces = [...state.places.values()].filter((p) => p.data.junction === id);
    const walkCount = [...state.walkways.values()].filter((w) => w.data.from === id || w.data.to === id).length;
    const label = el("input", { type: "text", maxlength: "80", value: data.label || "" });
    label.value = data.label || "";
    const errors = el("div");
    const save = el("button", { type: "button", class: "primary", text: "Save", onclick: async () => {
        clear(errors);
        save.disabled = true;
        try {
            const response = await updateJunction(id, { label: label.value.trim(), lat: data.lat, lng: data.lng });
            entry.data = { ...entry.data, ...response.junction };
            entry.marker.options.title = entry.data.label || "";
            toast("Junction saved.");
            renderPanel();
        } catch (error) {
            save.disabled = false;
            errors.append(errorBox(error.message));
        }
    } });
    const remove = el("button", { type: "button", class: "danger", text: "Delete", onclick: async () => {
        const text = "Delete this junction? It will also remove " + walkCount + " walkway(s) and unlink " + linkedPlaces.length + " place(s).";
        if (!(await confirmDialog(text))) return;
        remove.disabled = true;
        try {
            await deleteJunction(id);
            for (const [wid, w] of [...state.walkways]) {
                if (w.data.from === id || w.data.to === id) {
                    removeWalkLayers(w);
                    state.walkways.delete(wid);
                }
            }
            for (const p of linkedPlaces) p.data.junction = null;
            junctionLayer.removeLayer(entry.marker);
            state.junctions.delete(id);
            state.selected = null;
            refreshStyles();
            renderPanel();
            toast("Junction deleted.");
        } catch (error) {
            remove.disabled = false;
            errors.append(errorBox(error.message));
        }
    } });
    const start = el("button", { type: "button", class: "plain", text: "Draw walkway from here", onclick: () => {
        setMode("connect");
        state.connectFrom = id;
        setHint("Starting at " + junctionLabel(id) + ". Now click the junction it should connect to.");
        refreshStyles();
    } });
    const nodes = [
        el("h3", { text: "Junction" }),
        field("Name (optional, for example \"Library corner\")", label),
        el("p", { class: "muted", text: data.lat.toFixed(6) + ", " + data.lng.toFixed(6) + " · " + walkCount + " walkway(s)" })
    ];
    if (linkedPlaces.length > 0) {
        nodes.push(el("p", { text: "Places linked here:" }));
        nodes.push(el("ul", { class: "mini-list" }, linkedPlaces.map((p) => el("li", { text: p.data.name }))));
    }
    nodes.push(errors, el("div", { class: "btn-row" }, [save, start, remove]));
    return nodes;
}

function checkbox(checked, onChange) {
    const input = el("input", { type: "checkbox" });
    input.checked = checked;
    input.addEventListener("change", () => onChange(input.checked));
    return input;
}

function connectOptions() {
    const d = state.defaults;
    const rows = [
        el("label", { class: "check" }, [checkbox(d.bidirectional, (v) => { d.bidirectional = v; }), "Can be walked both ways"]),
        el("label", { class: "check" }, [checkbox(d.drivable, (v) => { d.drivable = v; renderPanel(); }), "Drivable"])
    ];
    if (d.drivable) {
        rows.push(el("label", { class: "check" }, [checkbox(d.driveBidirectional, (v) => { d.driveBidirectional = v; }), "Drivable both ways (untick for one-way)"]));
    }
    return rows;
}

function renderWalkwayPanel(id) {
    const entry = state.walkways.get(id);
    const data = entry.data;
    const name = el("input", { type: "text", maxlength: "80" });
    name.value = data.name || "";
    const two = el("input", { type: "checkbox" });
    two.checked = data.bidirectional !== false;
    const drive = el("input", { type: "checkbox" });
    drive.checked = data.drivable === true;
    const driveTwo = el("input", { type: "checkbox" });
    driveTwo.checked = data.driveBidirectional !== false;
    const driveTwoRow = el("label", { class: "check" }, [driveTwo, "Drivable both ways (untick for one-way)"]);
    driveTwoRow.hidden = !drive.checked;
    drive.addEventListener("change", () => { driveTwoRow.hidden = !drive.checked; });
    const errors = el("div");
    const save = el("button", { type: "button", class: "primary", text: "Save", onclick: async () => {
        clear(errors);
        save.disabled = true;
        try {
            const response = await updateWalkway(id, { name: name.value.trim(), bidirectional: two.checked, drivable: drive.checked, driveBidirectional: driveTwo.checked });
            entry.data = { ...entry.data, ...response.walkway };
            toast("Walkway saved.");
            refreshStyles();
            renderPanel();
        } catch (error) {
            save.disabled = false;
            errors.append(errorBox(error.message));
        }
    } });
    const remove = el("button", { type: "button", class: "danger", text: "Delete", onclick: async () => {
        if (!(await confirmDialog("Delete this walkway?"))) return;
        remove.disabled = true;
        try {
            await deleteWalkway(id);
            removeWalkLayers(entry);
            state.walkways.delete(id);
            state.selected = null;
            refreshStyles();
            renderPanel();
            toast("Walkway deleted.");
        } catch (error) {
            remove.disabled = false;
            errors.append(errorBox(error.message));
        }
    } });
    return [
        el("h3", { text: "Walkway" }),
        el("p", { class: "muted", text: junctionLabel(data.from) + " to " + junctionLabel(data.to) + " · " + Math.round(data.distanceMeters) + " m" }),
        field("Name (optional)", name),
        el("label", { class: "check" }, [two, "Can be walked both ways"]),
        el("label", { class: "check" }, [drive, "Drivable"]),
        driveTwoRow,
        errors,
        el("div", { class: "btn-row" }, [save, remove])
    ];
}

function nearestJunction(place) {
    let best = null;
    for (const [id, entry] of state.junctions) {
        const d = distance(place, entry.data);
        if (!best || d < best.d) best = { id, d };
    }
    return best;
}

function renderPlacePanel(id) {
    const entry = state.places.get(id);
    const data = entry.data;
    const errors = el("div");
    const nodes = [
        el("h3", { text: data.name }),
        el("p", { class: "muted", text: (CATEGORIES[data.category] || data.category) + (data.isActive === false ? " · hidden from users" : "") })
    ];
    if (data.junction && state.junctions.has(data.junction)) {
        nodes.push(el("p", { text: "Linked to: " + junctionLabel(data.junction) + " (" + Math.round(distance(data, state.junctions.get(data.junction).data)) + " m away)" }));
    } else {
        nodes.push(el("p", { class: "warn", text: "Not linked to a junction yet." }));
    }
    async function setLink(junctionId, button) {
        clear(errors);
        button.disabled = true;
        try {
            const response = await updatePlace(id, { junction: junctionId });
            data.junction = response.place.junction ? String(response.place.junction) : null;
            toast(junctionId ? "Place linked." : "Place unlinked.");
            refreshStyles();
            renderPanel();
        } catch (error) {
            button.disabled = false;
            errors.append(errorBox(error.message));
        }
    }
    const nearest = nearestJunction(data);
    const row = el("div", { class: "btn-row" });
    if (nearest) {
        const link = el("button", { type: "button", class: "primary", text: "Link to nearest junction (" + Math.round(nearest.d) + " m)", onclick: () => setLink(nearest.id, link) });
        row.append(link);
    } else {
        nodes.push(el("p", { class: "muted", text: "Add a junction first, then link this place to it." }));
    }
    if (data.junction) {
        const unlink = el("button", { type: "button", class: "plain", text: "Unlink", onclick: () => setLink(null, unlink) });
        row.append(unlink);
    }
    nodes.push(
        errors,
        row
    );
    return nodes;
}

function renderPanel() {
    clear(panel);
    const sel = state.selected;
    let nodes;
    if (state.mode === "connect") {
        nodes = [
            el("h3", { text: "Draw walkway" }),
            el("p", { text: state.connectFrom ? "Starting at " + junctionLabel(state.connectFrom) + "." : "Click the first junction." }),
            el("p", { class: "muted", text: "These settings apply to each walkway you draw next. One-way follows the order you click the junctions." }),
            ...connectOptions()
        ];
    } else if (state.mode === "junction") {
        nodes = [
            el("h3", { text: "Add junction" }),
            el("p", { text: "Click the map to drop a junction." }),
            el("p", { class: "muted", text: "Put junctions where paths cross, bend, or meet a building entrance. Zoom in for accuracy." })
        ];
    } else if (sel && sel.type === "junction" && state.junctions.has(sel.id)) {
        nodes = renderJunctionPanel(sel.id);
    } else if (sel && sel.type === "walkway" && state.walkways.has(sel.id)) {
        nodes = renderWalkwayPanel(sel.id);
    } else if (sel && sel.type === "place" && state.places.has(sel.id)) {
        nodes = renderPlacePanel(sel.id);
    } else {
        nodes = renderOverview();
    }
    panel.append(...nodes);
}

function fitToData() {
    const points = [...state.junctions.values()].map((e) => [e.data.lat, e.data.lng]);
    if (points.length === 0) {
        for (const e of state.places.values()) points.push([e.data.lat, e.data.lng]);
    }
    if (points.length > 0) map.fitBounds(points, { padding: [40, 40], maxZoom: 18 });
}

async function load() {
    setHint("Loading map data...");
    try {
        const [network, places] = await Promise.all([getNetwork(), listPlaces()]);
        for (const j of network.junctions || []) addJunctionToMap(j);
        for (const w of network.walkways || []) addWalkwayToMap(w);
        for (const p of places) addPlaceToMap(p);
        fitToData();
        setHint(HINTS[state.mode]);
        refreshStyles();
        renderPanel();
    } catch (error) {
        setHint(error.message, true);
        clear(panel);
        panel.append(
            el("h3", { text: "Could not load" }),
            el("p", { text: error.message }),
            el("button", { type: "button", class: "primary", text: "Try again", onclick: () => window.location.reload() })
        );
    }
}

function start() {
    map = L.map("map", { center: [CAMPUS_CENTER.lat, CAMPUS_CENTER.lng], zoom: MAP_ZOOM, maxZoom: 20, doubleClickZoom: false });
    map.attributionControl.setPrefix(false);
    const satelliteLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20, maxNativeZoom: 18, attribution: "Imagery &copy; Esri" }).addTo(map);
    const streetLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 20, maxNativeZoom: 19, attribution: "&copy; OpenStreetMap" });
    L.control.layers({ Satellite: satelliteLayer, Map: streetLayer }, null, { position: "topright", collapsed: false }).addTo(map);
    casingLayer = L.layerGroup().addTo(map);
    walkLayer = L.layerGroup().addTo(map);
    arrowLayer = L.layerGroup().addTo(map);
    placeLayer = L.layerGroup().addTo(map);
    junctionLayer = L.layerGroup().addTo(map);
    map.on("click", onMapClick);

    document.querySelectorAll("#modes .mode").forEach((button) => {
        button.addEventListener("click", () => setMode(button.dataset.mode));
    });
    document.getElementById("show-places").addEventListener("change", (event) => {
        if (event.target.checked) placeLayer.addTo(map);
        else map.removeLayer(placeLayer);
    });
    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        if (state.connectFrom) {
            state.connectFrom = null;
            setHint(HINTS[state.mode]);
        } else if (state.mode === "select") {
            state.selected = null;
        }
        refreshStyles();
        renderPanel();
    });
    setHint(HINTS.select);
    load();
}

if (hasValidSession()) start();
