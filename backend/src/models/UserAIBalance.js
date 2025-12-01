const mongoose = require('mongoose');

/**
 * User AI Coin Balance
 * userId: String (from auth system)
 */
const UserAIBalanceSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    balance: {
      type: Number,
      default: 100, // New users get 100 AI Coins for free
      min: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('UserAIBalance', UserAIBalanceSchema);

