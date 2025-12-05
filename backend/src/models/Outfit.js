/**
 * 衣服/场景模型
 * 
 * 每个 AI 主播可以有多套衣服/场景
 * 按尺度分层，需要解锁才能查看
 */

const mongoose = require('mongoose');

const OutfitSchema = new mongoose.Schema({
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true, index: true },
  
  name: { type: String, required: true },           // "居家睡衣"、"黑丝OL"、"比基尼"
  description: { type: String, default: '' },       // 描述
  
  // 尺度等级 1-5
  // 1: 日常 (免费)
  // 2: 性感 (低亲密度)
  // 3: 暴露 (中亲密度)
  // 4: 大尺度 (高亲密度或金币)
  // 5: 极限 (需要礼物解锁)
  level: { type: Number, required: true, min: 1, max: 5 },
  
  // 解锁条件
  unlockType: { 
    type: String, 
    enum: ['free', 'intimacy', 'coins', 'gift'],
    default: 'intimacy'
  },
  unlockValue: { type: Number, default: 0 },        // 解锁需要的值
  unlockGiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gift' }, // 如果是礼物解锁
  
  // 预览图（打码或裁剪版本，用于展示但未解锁时）
  previewUrl: { type: String, default: '' },
  
  // 完整内容
  imageUrls: [{ type: String }],                    // 图片数组
  videoUrls: [{ type: String }],                    // 视频数组
  
  // 排序
  sortOrder: { type: Number, default: 0 },
  
  // 是否启用
  isActive: { type: Boolean, default: true },
  
}, { timestamps: true });

// 索引
OutfitSchema.index({ agentId: 1, level: 1, sortOrder: 1 });

module.exports = mongoose.model('Outfit', OutfitSchema);
