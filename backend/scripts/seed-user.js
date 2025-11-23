const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('Please define MONGO_URI in your environment. See .env.example');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const email = process.env.SEED_EMAIL || 'test@example.com';
  const password = process.env.SEED_PASSWORD || 'password123';
  const name = process.env.SEED_NAME || 'Test User';

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`User ${email} already exists`);
    process.exit(0);
  }

  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(password, salt);

  const user = new User({ name, email, password: hashed });
  await user.save();
  console.log('Seed user created:', email);
  console.log('Password:', password);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
