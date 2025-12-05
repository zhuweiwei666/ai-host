/**
 * 礼物模型
 * 
 * 定义用户可以送给 AI 主播的礼物
 * 每个礼物有不同价格、亲密度加成和特殊效果
 */

const mongoose = require('mongoose');

const GiftSchema = new mongoose.Schema({
  name: { type: String, required: true },           // 礼物名称
  emoji: { type: String, required: true },          // 礼物表情
  description: { type: String, default: '' },       // 礼物描述
  price: { type: Number, required: true },          // 金币价格
  intimacyBonus: { type: Number, default: 0 },      // 送出后增加的亲密度
  category: { 
    type: String, 
    enum: ['flower', 'food', 'accessory', 'luxury', 'special'],
    default: 'flower'
  },
  
  // 特殊效果
  specialEffect: { 
    type: String, 
    enum: ['none', 'unlock_outfit', 'special_photo', 'voice_message', 'video_call'],
    default: 'none'
  },
  specialEffectValue: { type: String, default: '' }, // 效果参数（如 outfit ID）
  
  // AI 收到礼物后的回复模板（可以有多个随机选）
  responseTemplates: [{ type: String }],
  
  // 是否启用
  isActive: { type: Boolean, default: true },
  
  // 排序权重
  sortOrder: { type: Number, default: 0 },
  
}, { timestamps: true });

module.exports = mongoose.model('Gift', GiftSchema);
