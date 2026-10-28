const { Client } = require("../models");
const { asyncHandler } = require("../utils/asyncHandler");
const { HttpError } = require("../utils/httpError");

const ping = asyncHandler(async (req, res) => {
    const { clientId, userType } = req.body;
    const name = String(req.body.name || "").trim();
    const contact = String(req.body.contact || "").trim();
    const rollNo = String(req.body.rollNo || "").trim().toUpperCase();
    const identified = Boolean(name && (userType === "student" ? rollNo : contact));

    const existing = await Client.findOne({ clientId });
    if (!existing) {
        await Client.create({
            clientId,
            userType,
            name,
            contact: identified && userType !== "student" ? contact : "",
            rollNo: identified && userType === "student" ? rollNo : "",
            isGuest: !identified
        });
        return res.status(201).json({ ok: true });
    }

    existing.userType = userType;
    if (identified) {
        existing.name = name;
        existing.contact = userType === "student" ? "" : contact;
        existing.rollNo = userType === "student" ? rollNo : "";
        existing.isGuest = false;
    }
    existing.visitCount += 1;
    existing.lastSeenAt = new Date();
    await existing.save();
    return res.json({ ok: true });
});

function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const list = asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const filter = {};
    if (req.query.type === "registered") filter.isGuest = false;
    if (req.query.type === "guest") filter.isGuest = true;
    if (req.query.userType) filter.userType = req.query.userType;
    const q = String(req.query.q || "").trim();
    if (q) {
        const pattern = new RegExp(escapeRegex(q), "i");
        filter.$or = [{ name: pattern }, { contact: pattern }, { rollNo: pattern }];
    }

    const [clients, total, registered, guests] = await Promise.all([
        Client.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .select("-__v")
            .lean(),
        Client.countDocuments(filter),
        Client.countDocuments({ isGuest: false }),
        Client.countDocuments({ isGuest: true })
    ]);
    res.json({ count: clients.length, total, page, totals: { registered, guests }, clients });
});

const remove = asyncHandler(async (req, res) => {
    const deleted = await Client.findByIdAndDelete(req.params.id);
    if (!deleted) {
        throw new HttpError(404, "User not found.");
    }
    res.json({ ok: true });
});

module.exports = { ping, list, remove };
