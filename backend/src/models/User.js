const mongoose = require('mongoose');

// Simple User schema for managing users
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, unique: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  // We can link to UserAIBalance via userId (which matches _id or username here)
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);

