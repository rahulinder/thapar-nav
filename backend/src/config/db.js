const dns = require("node:dns");
const mongoose = require("mongoose");

mongoose.set("strictQuery", true);

async function prepareDns(uri) {
    const match = /^mongodb\+srv:\/\/(?:[^@/]*@)?([^/?]+)/.exec(uri);
    if (!match) {
        return;
    }
    try {
        await dns.promises.resolveSrv("_mongodb._tcp." + match[1]);
    } catch {
        dns.setServers(["8.8.8.8", "1.1.1.1"]);
    }
}

async function connectDatabase(uri) {
    await prepareDns(uri);
    mongoose.connection.on("error", (error) => {
        console.error("Database error:", error.message);
    });
    mongoose.connection.on("disconnected", () => {
        console.warn("Database disconnected");
    });

    await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 15000,
        maxPoolSize: 10
    });
    console.log("Database connected");
}

async function disconnectDatabase() {
    await mongoose.disconnect();
}

function isDatabaseReady() {
    return mongoose.connection.readyState === 1;
}

module.exports = { connectDatabase, disconnectDatabase, isDatabaseReady };