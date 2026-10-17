const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connectDb } = require('../src/config/db');
const Admin = require('../src/models/Admin');

async function main() {
  const [username, password] = process.argv.slice(2);
  if (!username || !password) {
    console.log('Usage: npm run create-admin -- <username> <password>');
    process.exit(1);
  }
  if (password.length < 8) {
    console.log('Password must be at least 8 characters.');
    process.exit(1);
  }

  await connectDb();
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await Admin.findOneAndUpdate(
    { username: username.toLowerCase() },
    { username: username.toLowerCase(), passwordHash },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`Admin "${admin.username}" is ready.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
