const { EditLog } = require("../models");

function adminLabel(admin) {
    if (!admin) {
        return "Unknown";
    }
    return admin.displayName || admin.username || "Unknown";
}

function show(value) {
    if (value === undefined || value === null || value === "") {
        return "(empty)";
    }
    if (value && typeof value.toHexString === "function") {
        return String(value);
    }
    if (Array.isArray(value)) {
        return value.length ? value.join(", ").slice(0, 200) : "(empty)";
    }
    if (typeof value === "object") {
        return JSON.stringify(value).slice(0, 200);
    }
    return String(value).slice(0, 200);
}

function snapshot(doc, fields) {
    const data = {};
    for (const field of fields) {
        const value = doc.get(field);
        data[field] = Array.isArray(value) ? Array.from(value) : value;
    }
    return data;
}

function sameValue(a, b) {
    return show(a) === show(b);
}

function diff(before, after, fields) {
    const changes = [];
    for (const field of fields) {
        if (!sameValue(before[field], after[field])) {
            changes.push({ field, from: show(before[field]), to: show(after[field]) });
        }
    }
    return changes;
}

async function record(req, { action, entity, entityId, entityName, summary = "", changes = [] }) {
    try {
        await EditLog.create({
            admin: req.admin ? req.admin._id : null,
            adminName: adminLabel(req.admin),
            action,
            entity,
            entityId: String(entityId),
            entityName: String(entityName || "").slice(0, 200),
            summary: String(summary).slice(0, 300),
            changes
        });
    } catch (error) {
        console.error("Edit history could not be saved:", error.message);
    }
}

module.exports = { record, snapshot, diff, show };
