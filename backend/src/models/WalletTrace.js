const mongoose = require('mongoose');

/**
 * WalletTrace Model
 * Prevents duplicate rewards/transactions using traceId
 */
const WalletTraceSchema = new mongoose.Schema({
  traceId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  itemType: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 * 30 // Auto-delete after 30 days
  }
}, {
  timestamps: true
});

// Compound index for faster lookups
WalletTraceSchema.index({ userId: 1, traceId: 1 }, { unique: true });

module.exports = mongoose.model('WalletTrace', WalletTraceSchema);

