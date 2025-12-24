const mongoose = require('mongoose');

/**
 * Wallet Transaction Log
 */
const WalletTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    appId: {
      type: String,
      index: true
    },
    type: {
      type: String,
      enum: ['recharge', 'consume', 'reward'],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    // Balance snapshow
    beforeBalance: {
      type: Number,
      required: true
    },
    afterBalance: {
      type: Number,
      required: true
    },
    // ai_message, ai_image, ai_voice, ad_reward, manual_gift
    itemType: {
      type: String,
      required: true
    },
    // Optional reference ID (e.g. messageId)
    refId: {
      type: String
    },
    meta: {
      type: Object
    }
  },
  {
    timestamps: true
  }
);

WalletTransactionSchema.index({ appId: 1, createdAt: 1 });
WalletTransactionSchema.index({ userId: 1, createdAt: 1 });

module.exports = mongoose.model('WalletTransaction', WalletTransactionSchema);

