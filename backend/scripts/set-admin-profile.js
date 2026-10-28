const { loadEnv } = require("../src/config/env");
const { connectDatabase, disconnectDatabase } = require("../src/config/db");
const { Admin } = require("../src/models");

async function main() {
    const [username, email, phone, displayName] = process.argv.slice(2);
    if (!username || !email || !phone) {
        throw new Error("Usage: node scripts/set-admin-profile.js <username> <email> <phone> [display name]");
    }
    const env = loadEnv();
    await connectDatabase(env.mongoUri);
    try {
        const admin = await Admin.findOne({ username: username.toLowerCase() });
        if (!admin) throw new Error('No admin named "' + username + '".');
        admin.email = email;
        admin.phone = phone;
        if (displayName) admin.displayName = displayName;
        await admin.save();
        console.log('Updated profile for "' + admin.username + '".');
    } finally {
        await disconnectDatabase();
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
