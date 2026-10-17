const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { HttpError } = require("../utils/httpError");

function corsMiddleware(allowedOrigins) {
    return cors({
        origin(origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            return callback(
                new HttpError(
                    403,
                    "This website is not allowed to use the server. Add " + origin + " to CLIENT_ORIGINS."
                )
            );
        },
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        maxAge: 600
    });
}

function helmetMiddleware() {
    return helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" }
    });
}

function limiter({ windowMs, max, message }) {
    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => res.status(429).json({ error: message })
    });
}

function createLimiters(options = {}) {
    const minutes = 15 * 60 * 1000;
    const settings = {
        general: 300,
        login: 10,
        write: 120,
        route: 120,
        ...options
    };
    return {
        general: limiter({
            windowMs: minutes,
            max: settings.general,
            message: "Too many requests. Please wait a few minutes."
        }),
        login: limiter({
            windowMs: minutes,
            max: settings.login,
            message: "Too many login attempts. Please try again in 15 minutes."
        }),
        write: limiter({
            windowMs: minutes,
            max: settings.write,
            message: "Too many changes in a short time. Please slow down."
        }),
        route: limiter({
            windowMs: minutes,
            max: settings.route,
            message: "Too many route requests. Please wait a few minutes."
        })
    };
}

module.exports = { corsMiddleware, helmetMiddleware, createLimiters };
