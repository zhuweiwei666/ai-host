const mongoose = require('mongoose');

/**
 * Immutable ledger entry (source of truth).
 * - Every balance change MUST be represented by one LedgerEntry.
 * - Idempotency: (userId, idempotencyKey) unique.
 */
const LedgerEntrySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },

    currency: { type: String, default: 'credits', index: true }, // currently only 'credits'

    // Positive = credit, negative = debit
    delta: { type: Number, required: true },

    // High-level category
    type: {
      type: String,
      enum: ['credit', 'debit', 'adjustment'],
      required: true,
      index: true,
    },

    // Reason codes: iap_topup, ad_reward, admin_grant, ai_message, ai_image, etc.
    reason: { type: String, required: true, index: true },

    // Required for consistent idempotency (can be random UUID for non-idempotent flows)
    idempotencyKey: { type: String, required: true },

    refType: { type: String },
    refId: { type: String },

    meta: { type: Object },
  },
  { timestamps: true }
);

LedgerEntrySchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
LedgerEntrySchema.index({ userId: 1, createdAt: -1 });
LedgerEntrySchema.index({ refType: 1, refId: 1 });

module.exports = mongoose.model('LedgerEntry', LedgerEntrySchema);

