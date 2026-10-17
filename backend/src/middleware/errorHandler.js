function notFound(req, res) {
    res.status(404).json({ error: "Not found: " + req.method + " " + req.path });
}

function errorHandler(error, req, res, next) {
    if (res.headersSent) {
        return next(error);
    }

    if (error.name === "HttpError") {
        return res.status(error.status).json({ error: error.message, details: error.details });
    }

    if (error.type === "entity.parse.failed") {
        return res.status(400).json({ error: "The request body is not valid JSON." });
    }
    if (error.type === "entity.too.large") {
        return res.status(413).json({ error: "The request body is too large." });
    }

    if (error.name === "ValidationError" && error.errors) {
        const details = Object.values(error.errors).map((item) => ({
            field: item.path,
            message: item.message
        }));
        return res.status(400).json({ error: details[0].message, details });
    }

    if (error.name === "CastError") {
        return res.status(400).json({ error: "Invalid value for " + error.path + "." });
    }

    const message = String(error.message || "");
    if (error.code === 11000 || /E11000|UNIQUE constraint failed/.test(message)) {
        const key = Object.keys(error.keyPattern || {})[0] || (/nameKey/.test(message) ? "nameKey" : "value");
        const field = key === "nameKey" ? "name" : key;
        return res.status(409).json({ error: "That " + field + " already exists." });
    }

    console.error(error);
    const isProduction = process.env.NODE_ENV === "production";
    return res.status(500).json({
        error: isProduction ? "Something went wrong on the server." : error.message
    });
}

module.exports = { notFound, errorHandler };
