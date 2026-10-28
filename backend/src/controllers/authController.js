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

const MIN_PASSWORD_LENGTH = 10;

const updateProfile = asyncHandler(async (req, res) => {
    const admin = req.admin;
    for (const field of ["displayName", "email", "phone", "avatar"]) {
        if (req.body[field] !== undefined) {
            admin[field] = req.body[field];
        }
    }
    await admin.save();
    res.json({ admin: admin.toJSON() });
});

const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const admin = await Admin.findById(req.admin._id).select("+passwordHash");
    if (!admin || !(await admin.verifyPassword(currentPassword))) {
        throw new HttpError(400, "Your current password is wrong.");
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
        throw new HttpError(400, `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (newPassword === currentPassword) {
        throw new HttpError(400, "New password must be different from the current one.");
    }
    admin.passwordHash = await Admin.hashPassword(newPassword);
    await admin.save();
    res.json({ ok: true });
});

module.exports = { login, me, updateProfile, changePassword };
