import { CATEGORIES, ROLES, CAMPUS_BOUNDS } from "./config.js";

export const COLUMNS = ["category", "name", "lat", "lng", "description", "aliases", "visibleTo", "openingHours", "isEntrance", "isActive"];

const HEADER_NAMES = {
    category: "category",
    name: "name",
    lat: "lat",
    latitude: "lat",
    lng: "lng",
    lon: "lng",
    long: "lng",
    longitude: "lng",
    description: "description",
    aliases: "aliases",
    visibleto: "visibleTo",
    openinghours: "openingHours",
    hours: "openingHours",
    isentrance: "isEntrance",
    isactive: "isActive"
};

const REQUIRED = ["name", "category", "lat", "lng"];
const EMPTY_WORDS = new Set(["", "null", "none", "n/a", "na", "-", "nil", "undefined"]);

const CATEGORY_LOOKUP = new Map();
for (const [key, label] of Object.entries(CATEGORIES)) {
    CATEGORY_LOOKUP.set(key, key);
    CATEGORY_LOOKUP.set(label.toLowerCase(), key);
}
CATEGORY_LOOKUP.set("hostels", "hostel");
CATEGORY_LOOKUP.set("gates", "gate");
CATEGORY_LOOKUP.set("library", "library");
CATEGORY_LOOKUP.set("administration", "admin");

const ROLE_LOOKUP = new Map([
    ["student", "student"],
    ["students", "student"],
    ["staff", "staff"],
    ["teacher", "staff"],
    ["teachers", "staff"],
    ["faculty", "staff"],
    ["visitor", "visitor"],
    ["visitors", "visitor"],
    ["guest", "visitor"],
    ["guests", "visitor"]
]);

function clean(value) {
    return String(value === undefined || value === null ? "" : value).trim();
}

function textOrEmpty(value) {
    const text = clean(value);
    return EMPTY_WORDS.has(text.toLowerCase()) ? "" : text;
}

function toBool(value, fallback) {
    const text = clean(value).toLowerCase();
    if (["true", "yes", "y", "1"].includes(text)) return true;
    if (["false", "no", "n", "0"].includes(text)) return false;
    return text === "" || EMPTY_WORDS.has(text) ? fallback : null;
}

export function nameKey(name) {
    return clean(name).replace(/\s+/g, " ").toLowerCase();
}

export function readTable(rows) {
    if (rows.length === 0) return { error: "The file is empty." };
    const headers = rows[0].map((h) => HEADER_NAMES[clean(h).toLowerCase().replace(/[\s_-]+/g, "")]);
    const ignored = rows[0].filter((h, i) => !headers[i] && clean(h) !== "").map(clean);
    const missing = REQUIRED.filter((column) => !headers.includes(column));
    if (missing.length > 0) {
        return { error: "These required columns are missing: " + missing.join(", ") + ". Check the first row of your file." };
    }
    const records = rows.slice(1).map((cells, i) => {
        const record = { line: i + 2 };
        headers.forEach((column, index) => {
            if (column) record[column] = cells[index] === undefined ? "" : cells[index];
        });
        return record;
    });
    return { records, ignored };
}

function checkRecord(record) {
    const problems = [];
    const place = {};

    place.name = clean(record.name).replace(/\s+/g, " ");
    if (/[\ufffd]|\u00ef\u00bf/.test(place.name + clean(record.description))) {
        problems.push("This text has a broken character (probably an accent such as é). Fix it in your sheet and choose the file again.");
    }
    if (place.name.length < 2 || place.name.length > 120) problems.push("Name must be 2 to 120 characters.");

    const category = CATEGORY_LOOKUP.get(clean(record.category).toLowerCase());
    if (!category) problems.push('Unknown category "' + clean(record.category) + '".');
    else place.category = category;

    const lat = Number(clean(record.lat));
    const lng = Number(clean(record.lng));
    if (clean(record.lat) === "" || !Number.isFinite(lat)) problems.push("Latitude is not a number.");
    else if (lat < CAMPUS_BOUNDS.minLat || lat > CAMPUS_BOUNDS.maxLat) problems.push("Latitude is outside the campus area.");
    else place.lat = lat;
    if (clean(record.lng) === "" || !Number.isFinite(lng)) problems.push("Longitude is not a number.");
    else if (lng < CAMPUS_BOUNDS.minLng || lng > CAMPUS_BOUNDS.maxLng) problems.push("Longitude is outside the campus area.");
    else place.lng = lng;

    const roleText = textOrEmpty(record.visibleTo).toLowerCase();
    if (roleText === "" || roleText === "all" || roleText === "everyone") {
        place.visibleTo = Object.keys(ROLES);
    } else {
        const roles = new Set();
        for (const part of roleText.split(/[,;|/\s]+/).filter(Boolean)) {
            const role = ROLE_LOOKUP.get(part);
            if (role) roles.add(role);
            else problems.push('Unknown group "' + part + '" in visibleTo.');
        }
        if (roles.size > 0) place.visibleTo = [...roles];
    }

    place.openingHours = textOrEmpty(record.openingHours);
    if (place.openingHours.length > 120) problems.push("Opening hours are too long.");

    place.description = textOrEmpty(record.description);
    if (place.description.length > 1000) problems.push("Description is too long.");

    const aliasList = textOrEmpty(record.aliases).split(/[;|,]/).map((a) => a.trim()).filter(Boolean);
    if (aliasList.length > 10) problems.push("At most 10 other names are allowed.");
    if (aliasList.some((a) => a.length > 80)) problems.push("An other name is longer than 80 characters.");
    place.aliases = aliasList;

    const entrance = toBool(record.isEntrance, false);
    if (entrance === null) problems.push("isEntrance must be yes or no.");
    else place.isEntrance = entrance;
    const active = toBool(record.isActive, true);
    if (active === null) problems.push("isActive must be yes or no.");
    else place.isActive = active;

    return { place, problems };
}

export function checkRecords(records, existingKeys) {
    const seen = new Map();
    return records.map((record) => {
        const { place, problems } = checkRecord(record);
        const key = nameKey(place.name);
        let status = "ready";
        let message = "";
        if (problems.length > 0) {
            status = "error";
            message = problems.join(" ");
        } else if (seen.has(key)) {
            status = "error";
            message = "Same name as row " + seen.get(key) + ". Rename one of them.";
        } else if (existingKeys.has(key)) {
            status = "exists";
            message = "Already in the database.";
        }
        if (key && !seen.has(key)) seen.set(key, record.line);
        return { line: record.line, place, status, message, outcome: null };
    });
}

export function templateRows() {
    return [
        COLUMNS,
        ["library", "Example Library", "30.3544", "76.3700", "Main reading hall", "Central Library; Books", "student, staff, visitor", "08:00AM-08:00PM", "no", "yes"]
    ];
}
