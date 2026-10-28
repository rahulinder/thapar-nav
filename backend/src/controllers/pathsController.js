const { Junction, Walkway, Place } = require("../models");
const { HttpError } = require("../utils/httpError");
const { asyncHandler } = require("../utils/asyncHandler");
const { distanceMeters } = require("../utils/geo");
const { definedOnly } = require("../utils/objects");
const { invalidateGraph } = require("../services/routing");
const { record, snapshot, diff } = require("../services/audit");

const JUNCTION_FIELDS = ["label", "lat", "lng"];
const WALKWAY_FIELDS = ["name", "bidirectional", "drivable", "driveBidirectional"];

async function walkwayLabel(walkway) {
    if (walkway.name) {
        return walkway.name;
    }
    const junctions = await Junction.find({ _id: { $in: [walkway.from, walkway.to] } }).select("label").lean();
    const labels = new Map(junctions.map((item) => [String(item._id), item.label]));
    const start = labels.get(String(walkway.from)) || "a junction";
    const end = labels.get(String(walkway.to)) || "a junction";
    return start + " to " + end;
}

function distanceBetween(a, b) {
    return Math.max(0.1, Math.round(distanceMeters(a, b) * 10) / 10);
}

const getNetwork = asyncHandler(async (req, res) => {
    const [junctions, walkways] = await Promise.all([Junction.find().lean(), Walkway.find().lean()]);
    res.json({ junctions, walkways });
});

const listJunctions = asyncHandler(async (req, res) => {
    const junctions = await Junction.find().sort({ createdAt: 1 }).lean();
    res.json({ count: junctions.length, junctions });
});

const createJunction = asyncHandler(async (req, res) => {
    const { label, lat, lng } = req.body;
    const junction = await Junction.create({ label, lat, lng });
    await record(req, { action: "created", entity: "junction", entityId: junction._id, entityName: junction.label, summary: "Added a junction" });
    invalidateGraph();
    res.status(201).json({ junction });
});

const updateJunction = asyncHandler(async (req, res) => {
    const junction = await Junction.findById(req.params.id);
    if (!junction) {
        throw new HttpError(404, "Junction not found.");
    }
    const { label, lat, lng } = req.body;
    const before = snapshot(junction, JUNCTION_FIELDS);
    junction.set(definedOnly({ label, lat, lng }));
    await junction.save();
    const changes = diff(before, snapshot(junction, JUNCTION_FIELDS), JUNCTION_FIELDS);
    if (changes.length) {
        await record(req, { action: "updated", entity: "junction", entityId: junction._id, entityName: junction.label, summary: "Changed " + changes.map((item) => item.field).join(", "), changes });
    }

    const walkways = await Walkway.find({ $or: [{ from: junction._id }, { to: junction._id }] });
    for (const walkway of walkways) {
        const other = await Junction.findById(
            String(walkway.from) === String(junction._id) ? walkway.to : walkway.from
        ).lean();
        if (other) {
            walkway.distanceMeters = distanceBetween(junction, other);
            await walkway.save();
        }
    }

    invalidateGraph();
    res.json({ junction, updatedWalkways: walkways.length });
});

const deleteJunction = asyncHandler(async (req, res) => {
    const junction = await Junction.findByIdAndDelete(req.params.id);
    if (!junction) {
        throw new HttpError(404, "Junction not found.");
    }
    const removed = await Walkway.deleteMany({ $or: [{ from: junction._id }, { to: junction._id }] });
    await Place.updateMany({ junction: junction._id }, { $set: { junction: null } });
    await record(req, {
        action: "deleted",
        entity: "junction",
        entityId: junction._id,
        entityName: junction.label,
        summary: removed.deletedCount ? "Deleted a junction and " + removed.deletedCount + " walkway(s) attached to it" : "Deleted a junction"
    });
    invalidateGraph();
    res.json({ message: "Junction deleted.", id: req.params.id, removedWalkways: removed.deletedCount });
});

const listWalkways = asyncHandler(async (req, res) => {
    const walkways = await Walkway.find().sort({ createdAt: 1 }).lean();
    res.json({ count: walkways.length, walkways });
});

const createWalkway = asyncHandler(async (req, res) => {
    const { from, to, name, bidirectional, drivable, driveBidirectional } = req.body;
    if (String(from) === String(to)) {
        throw new HttpError(400, "A walkway cannot start and end at the same junction.");
    }
    const [start, end] = await Promise.all([Junction.findById(from).lean(), Junction.findById(to).lean()]);
    if (!start || !end) {
        throw new HttpError(400, "Both junctions must exist.");
    }
    const duplicate = await Walkway.exists({
        $or: [
            { from, to },
            { from: to, to: from }
        ]
    });
    if (duplicate) {
        throw new HttpError(409, "A walkway between these two junctions already exists.");
    }
    const walkway = await Walkway.create({
        from,
        to,
        name,
        bidirectional,
        drivable,
        driveBidirectional,
        distanceMeters: distanceBetween(start, end)
    });
    await record(req, { action: "created", entity: "walkway", entityId: walkway._id, entityName: walkway.name || start.label + " to " + end.label, summary: "Added a walkway" });
    invalidateGraph();
    res.status(201).json({ walkway });
});

const updateWalkway = asyncHandler(async (req, res) => {
    const walkway = await Walkway.findById(req.params.id);
    if (!walkway) {
        throw new HttpError(404, "Walkway not found.");
    }
    const { name, bidirectional, drivable, driveBidirectional } = req.body;
    const before = snapshot(walkway, WALKWAY_FIELDS);
    walkway.set(definedOnly({ name, bidirectional, drivable, driveBidirectional }));
    await walkway.save();
    const changes = diff(before, snapshot(walkway, WALKWAY_FIELDS), WALKWAY_FIELDS);
    if (changes.length) {
        await record(req, { action: "updated", entity: "walkway", entityId: walkway._id, entityName: await walkwayLabel(walkway), summary: "Changed " + changes.map((item) => item.field).join(", "), changes });
    }
    invalidateGraph();
    res.json({ walkway });
});

const deleteWalkway = asyncHandler(async (req, res) => {
    const walkway = await Walkway.findByIdAndDelete(req.params.id);
    if (!walkway) {
        throw new HttpError(404, "Walkway not found.");
    }
    await record(req, { action: "deleted", entity: "walkway", entityId: walkway._id, entityName: await walkwayLabel(walkway), summary: "Deleted a walkway" });
    invalidateGraph();
    res.json({ message: "Walkway deleted.", id: req.params.id });
});

module.exports = {
    getNetwork,
    listJunctions,
    createJunction,
    updateJunction,
    deleteJunction,
    listWalkways,
    createWalkway,
    updateWalkway,
    deleteWalkway
};
