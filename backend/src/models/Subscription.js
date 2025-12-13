const mongoose = require('mongoose');

/**
 * Subscription state machine.
 * providerSubId:
 * - Apple: originalTransactionId
 * - Google: purchaseToken (or linkedPurchaseToken)
 * - Stripe: stripeSubscriptionId
 */
const SubscriptionSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ['ios', 'android', 'stripe'], required: true, index: true },
    providerSubId: { type: String, required: true },

    userId: { type: String, required: true, index: true },
    productId: { type: String, required: true, index: true },

    status: {
      type: String,
      enum: ['active', 'trialing', 'past_due', 'canceled', 'expired', 'revoked'],
      default: 'active',
      index: true,
    },

    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    autoRenew: { type: Boolean, default: true },

    lastEventAt: { type: Date },
    raw: { type: Object }, // provider payload (redacted)
  },
  { timestamps: true }
);

SubscriptionSchema.index({ provider: 1, providerSubId: 1 }, { unique: true });
SubscriptionSchema.index({ userId: 1, status: 1 });
SubscriptionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Subscription', SubscriptionSchema);

