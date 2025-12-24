const mongoose = require('mongoose');

/**
 * Derived balance snapshot for fast reads.
 * Source of truth remains LedgerEntry.
 */
const UserBalanceSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    appId: { type: String, index: true }, // 所属应用ID
    creditsBalance: { type: Number, default: 0, min: 0 },
    version: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserBalance', UserBalanceSchema);

