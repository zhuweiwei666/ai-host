/**
 * 礼物记录模型
 * 
 * 记录用户送给 AI 主播的每一份礼物
 */

const mongoose = require('mongoose');

const GiftLogSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true, index: true },
  giftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gift', required: true },
  
  // 快照数据（防止礼物定义变化影响历史记录）
  giftName: { type: String, required: true },
  giftEmoji: { type: String, required: true },
  price: { type: Number, required: true },
  intimacyBonus: { type: Number, default: 0 },
  
  // AI 的回复
  aiResponse: { type: String, default: '' },
  
}, { timestamps: true });

// 索引
GiftLogSchema.index({ userId: 1, agentId: 1, createdAt: -1 });

module.exports = mongoose.model('GiftLog', GiftLogSchema);
