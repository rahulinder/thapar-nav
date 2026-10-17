const { Place, Junction } = require("../models");
const { HttpError } = require("../utils/httpError");
const { asyncHandler } = require("../utils/asyncHandler");
const { searchTokens } = require("../utils/text");

const EDITABLE_FIELDS = [
    "name",
    "category",
    "description",
    "aliases",
    "lat",
    "lng",
    "visibleTo",
    "openingHours",
    "isEntrance",
    "junction",
    "isActive"
];

function pickEditable(body) {
    const data = {};
    for (const field of EDITABLE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
            data[field] = body[field];
        }
    }
    return data;
}

async function assertJunctionExists(id) {
    if (id === null || id === undefined) {
        return;
    }
    const exists = await Junction.exists({ _id: id });
    if (!exists) {
        throw new HttpError(400, "That junction does not exist.");
    }
}

const listPlaces = asyncHandler(async (req, res) => {
    const { role, category, q } = req.query;
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const page = req.query.page ? Number(req.query.page) : 1;
    const includeInactive = req.query.includeInactive === "true" && Boolean(req.admin);

    const filter = {};
    if (!includeInactive) {
        filter.isActive = true;
    }
    if (role) {
        filter.visibleTo = role;
    }
    if (category) {
        filter.category = category;
    }
    if (q) {
        filter.$and = searchTokens(q).map((token) => ({
            $or: [{ name: token }, { aliases: token }, { description: token }]
        }));
    }

    const [places, total] = await Promise.all([
        Place.find(filter)
            .sort({ name: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Place.countDocuments(filter)
    ]);

    res.json({ count: places.length, total, page, places });
});

const getPlace = asyncHandler(async (req, res) => {
    const place = await Place.findById(req.params.id).lean();
    if (!place || (!place.isActive && !req.admin)) {
        throw new HttpError(404, "Place not found.");
    }
    res.json({ place });
});

const createPlace = asyncHandler(async (req, res) => {
    const data = pickEditable(req.body);
    await assertJunctionExists(data.junction);
    const place = await Place.create(data);
    res.status(201).json({ place });
});

const updatePlace = asyncHandler(async (req, res) => {
    const place = await Place.findById(req.params.id);
    if (!place) {
        throw new HttpError(404, "Place not found.");
    }
    const data = pickEditable(req.body);
    await assertJunctionExists(data.junction);
    place.set(data);
    await place.save();
    res.json({ place });
});

const deletePlace = asyncHandler(async (req, res) => {
    const place = await Place.findById(req.params.id);
    if (!place) {
        throw new HttpError(404, "Place not found.");
    }
    await place.deleteOne();
    res.json({ message: "Place deleted.", id: req.params.id });
});

function rowMessage(error) {
    if (error && error.name === "ValidationError" && error.errors) {
        return Object.values(error.errors)[0].message;
    }
    if (error && (error.code === 11000 || /E11000/.test(String(error.message)))) {
        return "That name already exists.";
    }
    if (error && error.name === "CastError") {
        return "Invalid value for " + error.path + ".";
    }
    console.error(error);
    return "This place could not be saved.";
}

const bulkImport = asyncHandler(async (req, res) => {
    const mode = req.body.mode === "update" ? "update" : "skip";
    const results = [];
    const counts = { created: 0, updated: 0, skipped: 0, failed: 0 };

    for (let index = 0; index < req.body.places.length; index += 1) {
        const raw = req.body.places[index];
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
            counts.failed += 1;
            results.push({ index, status: "failed", error: "This row is not a valid place." });
            continue;
        }
        const data = pickEditable(raw);
        delete data.junction;
        try {
            const key = typeof data.name === "string" ? data.name.trim().toLowerCase() : "";
            const existing = key ? await Place.findOne({ nameKey: key }) : null;
            if (existing && mode === "skip") {
                counts.skipped += 1;
                results.push({ index, status: "skipped" });
            } else if (existing) {
                existing.set(data);
                await existing.save();
                counts.updated += 1;
                results.push({ index, status: "updated", id: String(existing._id) });
            } else {
                const place = await Place.create(data);
                counts.created += 1;
                results.push({ index, status: "created", id: String(place._id) });
            }
        } catch (error) {
            counts.failed += 1;
            results.push({ index, status: "failed", error: rowMessage(error) });
        }
    }

    res.json({ ...counts, results });
});

module.exports = { listPlaces, getPlace, createPlace, updatePlace, deletePlace, bulkImport };
