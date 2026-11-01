const { Place, Junction, PlaceImage } = require("../models");
const { HttpError } = require("../utils/httpError");
const { asyncHandler } = require("../utils/asyncHandler");
const { searchTokens } = require("../utils/text");
const { record, snapshot, diff } = require("../services/audit");

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
    await record(req, { action: "created", entity: "place", entityId: place._id, entityName: place.name, summary: "Added a " + place.category + " place" });
    res.status(201).json({ place });
});

const updatePlace = asyncHandler(async (req, res) => {
    const place = await Place.findById(req.params.id);
    if (!place) {
        throw new HttpError(404, "Place not found.");
    }
    const data = pickEditable(req.body);
    await assertJunctionExists(data.junction);
    const before = snapshot(place, EDITABLE_FIELDS);
    place.set(data);
    await place.save();
    const changes = diff(before, snapshot(place, EDITABLE_FIELDS), EDITABLE_FIELDS);
    if (changes.length) {
        await record(req, { action: "updated", entity: "place", entityId: place._id, entityName: place.name, summary: "Changed " + changes.map((item) => item.field).join(", "), changes });
    }
    res.json({ place });
});

const deletePlace = asyncHandler(async (req, res) => {
    const place = await Place.findById(req.params.id);
    if (!place) {
        throw new HttpError(404, "Place not found.");
    }
    await place.deleteOne();
    await PlaceImage.deleteMany({ place: place._id });
    await record(req, { action: "deleted", entity: "place", entityId: place._id, entityName: place.name, summary: "Deleted a " + place.category + " place" });
    res.json({ message: "Place deleted.", id: req.params.id });
});

const PHOTO_SIGNATURES = [
    { type: "image/jpeg", test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    { type: "image/png", test: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
    { type: "image/webp", test: (b) => b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP" }
];

const getPhoto = asyncHandler(async (req, res) => {
    const place = await Place.findById(req.params.id).select("+photo isActive hasPhoto photoVersion").lean();
    if (!place || !place.hasPhoto || !place.photo || !place.photo.data || (!place.isActive && !req.admin)) {
        throw new HttpError(404, "This place has no photo.");
    }
    const data = Buffer.isBuffer(place.photo.data) ? place.photo.data : Buffer.from(place.photo.data.buffer || place.photo.data);
    res.set("Content-Type", place.photo.contentType);
    res.set("Content-Length", String(data.length));
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Cache-Control", place.isActive ? "public, max-age=86400" : "private, no-store");
    res.send(data);
});

const setPhoto = asyncHandler(async (req, res) => {
    const bytes = req.body;
    if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
        throw new HttpError(400, "Send the photo as a JPEG, PNG or WebP image.");
    }
    const match = PHOTO_SIGNATURES.find((entry) => entry.test(bytes));
    if (!match) {
        throw new HttpError(400, "That file is not a JPEG, PNG or WebP image.");
    }
    const place = await Place.findById(req.params.id).select("+photo");
    if (!place) {
        throw new HttpError(404, "Place not found.");
    }
    place.photo = { data: bytes, contentType: match.type };
    place.hasPhoto = true;
    place.photoVersion = (place.photoVersion || 0) + 1;
    await place.save();
    await record(req, { action: "updated", entity: "place", entityId: place._id, entityName: place.name, summary: "Changed photo", changes: [{ field: "photo", from: "", to: "new photo" }] });
    res.json({ place });
});

const removePhoto = asyncHandler(async (req, res) => {
    const place = await Place.findById(req.params.id).select("+photo");
    if (!place) {
        throw new HttpError(404, "Place not found.");
    }
    place.photo = undefined;
    place.hasPhoto = false;
    place.photoVersion = (place.photoVersion || 0) + 1;
    await place.save();
    await record(req, { action: "updated", entity: "place", entityId: place._id, entityName: place.name, summary: "Removed photo", changes: [{ field: "photo", from: "photo", to: "" }] });
    res.json({ place });
});

const MAX_GALLERY = 8;

const getGalleryImage = asyncHandler(async (req, res) => {
    const place = await Place.findById(req.params.id).select("isActive gallery").lean();
    const listed = place && (place.gallery || []).some((id) => String(id) === req.params.imageId);
    if (!place || !listed || (!place.isActive && !req.admin)) {
        throw new HttpError(404, "Image not found.");
    }
    const image = await PlaceImage.findById(req.params.imageId).lean();
    if (!image) {
        throw new HttpError(404, "Image not found.");
    }
    const data = Buffer.isBuffer(image.data) ? image.data : Buffer.from(image.data.buffer || image.data);
    res.set("Content-Type", image.contentType);
    res.set("Content-Length", String(data.length));
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Cache-Control", place.isActive ? "public, max-age=31536000, immutable" : "private, no-store");
    res.send(data);
});

const addGalleryImage = asyncHandler(async (req, res) => {
    const bytes = req.body;
    if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
        throw new HttpError(400, "Send the image as a JPEG, PNG or WebP file.");
    }
    const match = PHOTO_SIGNATURES.find((entry) => entry.test(bytes));
    if (!match) {
        throw new HttpError(400, "That file is not a JPEG, PNG or WebP image.");
    }
    const place = await Place.findById(req.params.id);
    if (!place) {
        throw new HttpError(404, "Place not found.");
    }
    if ((place.gallery || []).length >= MAX_GALLERY) {
        throw new HttpError(400, "A place can have at most " + MAX_GALLERY + " gallery images.");
    }
    const image = await PlaceImage.create({ place: place._id, data: bytes, contentType: match.type });
    place.gallery.push(image._id);
    await place.save();
    await record(req, { action: "updated", entity: "place", entityId: place._id, entityName: place.name, summary: "Added a gallery image", changes: [{ field: "gallery", from: "", to: "new image" }] });
    res.status(201).json({ place, imageId: image._id });
});

const removeGalleryImage = asyncHandler(async (req, res) => {
    const place = await Place.findById(req.params.id);
    if (!place) {
        throw new HttpError(404, "Place not found.");
    }
    const before = place.gallery.length;
    place.gallery = place.gallery.filter((id) => String(id) !== req.params.imageId);
    if (place.gallery.length === before) {
        throw new HttpError(404, "Image not found.");
    }
    await place.save();
    await PlaceImage.deleteOne({ _id: req.params.imageId, place: place._id });
    await record(req, { action: "updated", entity: "place", entityId: place._id, entityName: place.name, summary: "Removed a gallery image", changes: [{ field: "gallery", from: "image", to: "" }] });
    res.json({ place });
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
                const before = snapshot(existing, EDITABLE_FIELDS);
                existing.set(data);
                await existing.save();
                const changes = diff(before, snapshot(existing, EDITABLE_FIELDS), EDITABLE_FIELDS);
                if (changes.length) {
                    await record(req, { action: "updated", entity: "place", entityId: existing._id, entityName: existing.name, summary: "Changed " + changes.map((item) => item.field).join(", ") + " (CSV import)", changes });
                }
                counts.updated += 1;
                results.push({ index, status: "updated", id: String(existing._id) });
            } else {
                const place = await Place.create(data);
                await record(req, { action: "created", entity: "place", entityId: place._id, entityName: place.name, summary: "Added from CSV import" });
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

module.exports = { listPlaces, getPlace, createPlace, updatePlace, deletePlace, bulkImport, getPhoto, setPhoto, removePhoto, getGalleryImage, addGalleryImage, removeGalleryImage };
