const { EditLog } = require("../models");
const { asyncHandler } = require("../utils/asyncHandler");
const { searchTokens } = require("../utils/text");

const list = asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 25;
    const filter = {};
    if (req.query.entity) {
        filter.entity = req.query.entity;
    }
    if (req.query.action) {
        filter.action = req.query.action;
    }
    if (req.query.q) {
        filter.$and = searchTokens(req.query.q).map((token) => ({
            $or: [{ entityName: token }, { adminName: token }]
        }));
    }
    const [total, entries] = await Promise.all([
        EditLog.countDocuments(filter),
        EditLog.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .select("-admin -__v")
            .lean()
    ]);
    res.json({ count: entries.length, total, page, entries });
});

module.exports = { list };
