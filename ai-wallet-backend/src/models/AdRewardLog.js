const mongoose = require('mongoose');

/**
 * 广告奖励日志，防止同一条广告重复发奖
 * traceId 可以用：广告 SDK 返回的 transactionId / impressionId / serverSide 验证 ID
 */
const AdRewardLogSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    reward: {
      type: Number,
      required: true
    },
    adNetwork: {
      type: String // e.g. 'admob', 'ironSource', 'tiktok', etc.
    },
    placementId: {
      type: String
    },
    traceId: {
      type: String,
      unique: true // 防止重复
    },
    meta: {
      type: Object
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('AdRewardLog', AdRewardLogSchema);