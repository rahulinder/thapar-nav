const { asyncHandler } = require("../utils/asyncHandler");
const { findRoute } = require("../services/routing");

const getRoute = asyncHandler(async (req, res) => {
    const q = req.query;
    const from = q.fromPlace
        ? { placeId: q.fromPlace }
        : { lat: Number(q.fromLat), lng: Number(q.fromLng) };
    const to = q.toPlace
        ? { placeId: q.toPlace }
        : { lat: Number(q.toLat), lng: Number(q.toLng) };

    const route = await findRoute({
        from,
        to,
        role: q.role || null,
        accessible: q.accessible === "true"
    });
    res.json({ route });
});

module.exports = { getRoute };
