const { Junction, Walkway, Place } = require("../models");
const { HttpError } = require("../utils/httpError");
const { asyncHandler } = require("../utils/asyncHandler");
const { distanceMeters } = require("../utils/geo");
const { definedOnly } = require("../utils/objects");
const { invalidateGraph } = require("../services/routing");

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
    invalidateGraph();
    res.status(201).json({ junction });
});

const updateJunction = asyncHandler(async (req, res) => {
    const junction = await Junction.findById(req.params.id);
    if (!junction) {
        throw new HttpError(404, "Junction not found.");
    }
    const { label, lat, lng } = req.body;
    junction.set(definedOnly({ label, lat, lng }));
    await junction.save();

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
    invalidateGraph();
    res.json({ message: "Junction deleted.", id: req.params.id, removedWalkways: removed.deletedCount });
});

const listWalkways = asyncHandler(async (req, res) => {
    const walkways = await Walkway.find().sort({ createdAt: 1 }).lean();
    res.json({ count: walkways.length, walkways });
});

const createWalkway = asyncHandler(async (req, res) => {
    const { from, to, name, bidirectional, wheelchairAccessible } = req.body;
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
        wheelchairAccessible,
        distanceMeters: distanceBetween(start, end)
    });
    invalidateGraph();
    res.status(201).json({ walkway });
});

const updateWalkway = asyncHandler(async (req, res) => {
    const walkway = await Walkway.findById(req.params.id);
    if (!walkway) {
        throw new HttpError(404, "Walkway not found.");
    }
    const { name, bidirectional, wheelchairAccessible } = req.body;
    walkway.set(definedOnly({ name, bidirectional, wheelchairAccessible }));
    await walkway.save();
    invalidateGraph();
    res.json({ walkway });
});

const deleteWalkway = asyncHandler(async (req, res) => {
    const walkway = await Walkway.findByIdAndDelete(req.params.id);
    if (!walkway) {
        throw new HttpError(404, "Walkway not found.");
    }
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
