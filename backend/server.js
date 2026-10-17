const { loadEnv } = require("./src/config/env");
const { connectDatabase, disconnectDatabase } = require("./src/config/db");
const { createApp } = require("./src/app");

async function start() {
    const env = loadEnv();
    const app = createApp(env);

    const server = app.listen(env.port, () => {
        console.log("Server listening on port " + env.port);
    });

    try {
        await connectDatabase(env.mongoUri);
    } catch (error) {
        console.error("Could not connect to the database:", error.message);
        server.close();
        process.exit(1);
    }

    async function shutdown(signal) {
        console.log(signal + " received, shutting down");
        server.close(async () => {
            await disconnectDatabase();
            process.exit(0);
        });
        setTimeout(() => process.exit(1), 10000).unref();
    }

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
}

process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection:", reason);
});

start().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
