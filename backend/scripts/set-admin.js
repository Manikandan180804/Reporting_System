const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('Please set MONGO_URI in .env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');
  const email = process.env.SEED_EMAIL || 'test@example.com';
  const user = await User.findOne({ email });
  if (!user) {
    console.error('User not found:', email);
    process.exit(1);
  }
  user.role = 'admin';
  await user.save();
  console.log('User set to admin:', email);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
