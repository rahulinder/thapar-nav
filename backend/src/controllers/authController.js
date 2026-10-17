const bcrypt = require("bcryptjs");
const { Admin } = require("../models");
const { HttpError } = require("../utils/httpError");
const { asyncHandler } = require("../utils/asyncHandler");
const { signToken } = require("../middleware/auth");

const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

const login = asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username: String(username).toLowerCase() }).select("+passwordHash");

    const valid = admin
        ? await admin.verifyPassword(password)
        : await bcrypt.compare(password, DUMMY_HASH).then(() => false);

    if (!admin || !valid || !admin.isActive) {
        throw new HttpError(401, "Wrong username or password.");
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    const env = req.app.locals.env;
    res.json({
        token: signToken(admin, env),
        expiresIn: env.jwtExpiresIn,
        admin: admin.toJSON()
    });
});

const me = asyncHandler(async (req, res) => {
    res.json({ admin: req.admin.toJSON() });
});

module.exports = { login, me };
