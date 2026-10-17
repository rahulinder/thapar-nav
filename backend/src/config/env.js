require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production";

function parseOrigins(value) {
    return String(value || "")
        .split(",")
        .map((item) => item.trim().replace(/\/+$/, ""))
        .filter(Boolean);
}

function loadEnv() {
    const env = {
        isProduction,
        isTest: process.env.NODE_ENV === "test",
        port: Number(process.env.PORT) || 5000,
        mongoUri: process.env.MONGODB_URI || "",
        jwtSecret: process.env.JWT_SECRET || "",
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
        clientOrigins: parseOrigins(process.env.CLIENT_ORIGINS)
    };

    const problems = [];
    if (!env.mongoUri) {
        problems.push("MONGODB_URI is missing");
    }
    if (!env.jwtSecret) {
        problems.push("JWT_SECRET is missing");
    } else if (isProduction && env.jwtSecret.length < 32) {
        problems.push("JWT_SECRET must be at least 32 characters in production");
    }
    if (isProduction && env.clientOrigins.length === 0) {
        problems.push("CLIENT_ORIGINS is missing");
    }

    if (problems.length > 0) {
        throw new Error("Invalid settings: " + problems.join("; "));
    }
    return Object.freeze(env);
}

module.exports = { loadEnv, parseOrigins };
