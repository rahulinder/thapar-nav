const jwt = require("jsonwebtoken");
const { Admin } = require("../models");
const { HttpError } = require("../utils/httpError");
const { asyncHandler } = require("../utils/asyncHandler");

function readToken(req) {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    return scheme === "Bearer" && token ? token : null;
}

async function resolveAdmin(req) {
    const token = readToken(req);
    if (!token) {
        return null;
    }
    let payload;
    try {
        payload = jwt.verify(token, req.app.locals.env.jwtSecret, { algorithms: ["HS256"] });
    } catch {
        throw new HttpError(401, "Your session has expired. Please log in again.");
    }
    const admin = await Admin.findById(payload.sub);
    if (!admin || !admin.isActive) {
        throw new HttpError(401, "This account is no longer active.");
    }
    return admin;
}

const requireAdmin = asyncHandler(async (req, res, next) => {
    const admin = await resolveAdmin(req);
    if (!admin) {
        throw new HttpError(401, "Please log in as an admin.");
    }
    req.admin = admin;
    next();
});

const optionalAdmin = asyncHandler(async (req, res, next) => {
    req.admin = await resolveAdmin(req);
    next();
});

function requireSuperAdmin(req, res, next) {
    if (!req.admin || req.admin.role !== "superadmin") {
        return next(new HttpError(403, "This action needs a super admin."));
    }
    return next();
}

function signToken(admin, env) {
    return jwt.sign({ sub: String(admin._id), role: admin.role }, env.jwtSecret, {
        algorithm: "HS256",
        expiresIn: env.jwtExpiresIn
    });
}

module.exports = { requireAdmin, optionalAdmin, requireSuperAdmin, signToken };
