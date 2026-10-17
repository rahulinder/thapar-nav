const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const { loadEnv } = require("../src/config/env");
const { connectDatabase, disconnectDatabase } = require("../src/config/db");
const { Admin } = require("../src/models");

async function ask(rl, question) {
    return (await rl.question(question)).trim();
}

async function main() {
    const env = loadEnv();
    const rl = readline.createInterface({ input: stdin, output: stdout });

    const username = process.argv[2] || (await ask(rl, "Admin username: "));
    const password = process.env.ADMIN_PASSWORD || (await ask(rl, "Password (at least 10 characters): "));
    const role = process.argv[3] === "superadmin" ? "superadmin" : "admin";
    rl.close();

    await connectDatabase(env.mongoUri);
    try {
        const existing = await Admin.findOne({ username: username.toLowerCase() });
        const passwordHash = await Admin.hashPassword(password);
        if (existing) {
            existing.passwordHash = passwordHash;
            existing.isActive = true;
            await existing.save();
            console.log('Updated password for "' + existing.username + '".');
        } else {
            const admin = await Admin.create({ username, passwordHash, role });
            console.log('Created ' + admin.role + ' "' + admin.username + '".');
        }
    } finally {
        await disconnectDatabase();
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
