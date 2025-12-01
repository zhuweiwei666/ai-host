const mongoose = require('mongoose');

/**
 * 钱包交易流水，用于审计和对账
 * type:
 *  - recharge: 充值（比如主系统充值、人工补偿）
 *  - consume: 消费（AI 聊天、解锁图片/语音/视频）
 *  - reward: 奖励（看广告、任务奖励）
 */
const WalletTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
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
    // 余额变动前/后，用于对账
    beforeBalance: {
      type: Number,
      required: true
    },
    afterBalance: {
      type: Number,
      required: true
    },
    // 业务标签：ai_message / ai_voice / ai_image / ai_video / ad_reward / manual 等
    itemType: {
      type: String
    },
    // 关联的业务对象，比如 aiAgentId / 消息ID / 订单ID 等
    bizId: {
      type: String
    },
    // 可选：额外 metadata（JSON）
    meta: {
      type: Object
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('WalletTransaction', WalletTransactionSchema);