const { loadEnv } = require("../src/config/env");
const { connectDatabase, disconnectDatabase } = require("../src/config/db");
const { Admin } = require("../src/models");

async function main() {
    const env = loadEnv();
    await connectDatabase(env.mongoUri);
    try {
        const admins = await Admin.find({ $or: [{ adminId: { $exists: false } }, { adminId: null }, { adminId: "" }] }).sort({ createdAt: 1 });
        for (const admin of admins) {
            admin.adminId = undefined;
            await admin.save();
            console.log(admin.username + " -> " + admin.adminId);
        }
        console.log(admins.length === 0 ? "Every admin already has an Admin ID." : "Assigned " + admins.length + " Admin ID(s).");
    } finally {
        await disconnectDatabase();
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
