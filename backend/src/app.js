const express = require("express");
const { corsMiddleware, helmetMiddleware, createLimiters } = require("./middleware/security");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { isDatabaseReady } = require("./config/db");
const { createPlacesRouter } = require("./routes/places");
const { createPathsRouter } = require("./routes/paths");
const { createRouteRouter } = require("./routes/route");
const { createAuthRouter } = require("./routes/auth");

function createApp(env, { limits } = {}) {
    const app = express();
    const limiters = createLimiters(limits);

    app.locals.env = env;
    app.disable("x-powered-by");
    app.set("trust proxy", 1);

    app.use(helmetMiddleware());
    app.use(corsMiddleware(env.clientOrigins));
    app.use(express.json({ limit: "10kb" }));

    app.get("/", (req, res) => {
        res.json({ name: "Thapar-Nav API", status: "ok" });
    });

    app.get("/api/health", (req, res) => {
        const ready = isDatabaseReady();
        res.status(ready ? 200 : 503).json({ status: ready ? "ok" : "starting", database: ready });
    });

    app.use("/api", limiters.general);
    app.use("/api/auth", createAuthRouter({ loginLimiter: limiters.login }));
    app.use("/api/places", createPlacesRouter({ writeLimiter: limiters.write }));
    app.use("/api/paths", createPathsRouter({ writeLimiter: limiters.write }));
    app.use("/api/route", createRouteRouter({ routeLimiter: limiters.route }));

    app.use(notFound);
    app.use(errorHandler);

    return app;
}

module.exports = { createApp };
