const mongoose = require('mongoose');

async function connectDB() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }
    await mongoose.connect(uri, {
      autoIndex: true
    });
    console.log('[AI Wallet] MongoDB connected');
  } catch (err) {
    console.error('[AI Wallet] MongoDB connection error:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;