require('dotenv').config();
const mongoose = require('mongoose');
const Incident = require('../models/Issue');

async function main(){
  await mongoose.connect(process.env.MONGO_URI);
  const inc = await Incident.findOne().sort({ createdAt: -1 }).lean();
  console.log(JSON.stringify(inc, null, 2));
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
