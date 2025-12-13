const mongoose = require('mongoose');

/**
 * Server-side product catalog.
 * - provider: ios | android | stripe | internal
 * - kind: topup (consumable) | subscription
 */
const ProductSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ['ios', 'android', 'stripe', 'internal'], required: true, index: true },
    productId: { type: String, required: true },
    kind: { type: String, enum: ['topup', 'subscription'], required: true, index: true },

    // For topups: creditsAmount (one-off)
    // For subscriptions: monthlyCredits (meta.monthlyCredits) and/or discountPercent
    creditsAmount: { type: Number, default: 0 },

    price: { type: String }, // display only (e.g. "$4.99"), authoritative price is at provider
    currencyCode: { type: String, default: 'USD' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },

    meta: { type: Object }, // { monthlyCredits, discountPercent, tier, ... }
  },
  { timestamps: true }
);

ProductSchema.index({ provider: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model('Product', ProductSchema);

