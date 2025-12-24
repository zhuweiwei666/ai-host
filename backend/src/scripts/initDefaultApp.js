const mongoose = require('mongoose');
const Application = require('../models/Application');
const User = require('../models/User');
const connectDB = require('../config/db');

const init = async () => {
  await connectDB();

  const appId = 'app_default';
  const secretKey = 'default_secret_key_change_me';

  let app = await Application.findOne({ appId });
  if (!app) {
    app = await Application.create({
      appId,
      name: 'Default AI App',
      secretKey,
      status: 'active'
    });
    console.log('Default app created:', app);
  } else {
    console.log('Default app already exists');
  }

  // Backfill existing users
  const result = await User.updateMany(
    { appId: { $exists: false } },
    { $set: { appId: app.appId } }
  );
  console.log(`Backfilled ${result.modifiedCount} users with appId: ${app.appId}`);

  process.exit(0);
};

init().catch(err => {
  console.error(err);
  process.exit(1);
});
