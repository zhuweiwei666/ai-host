const mongoose = require('mongoose');

/**
 * One-off purchase/top-up record.
 * Uniqueness is enforced by (provider, providerTxnId).
 */
const PurchaseSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ['ios', 'android', 'stripe'], required: true, index: true },
    providerTxnId: { type: String, required: true },

    userId: { type: String, required: true, index: true },
    productId: { type: String, required: true, index: true },

    status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'completed', index: true },

    // Link to ledger credit (for audit)
    creditedLedgerEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerEntry' },

    environment: { type: String }, // Sandbox / Production
    raw: { type: Object }, // provider payload (redacted)
  },
  { timestamps: true }
);

PurchaseSchema.index({ provider: 1, providerTxnId: 1 }, { unique: true });
PurchaseSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Purchase', PurchaseSchema);

