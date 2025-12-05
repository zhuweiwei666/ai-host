/**
 * AI 主动消息模型
 * 
 * 让 AI 主播主动给用户发消息，模拟真实社交
 * 
 * 消息类型:
 * - greeting: 时间问候 (早安、晚安等)
 * - missing: 想念消息 (用户不活跃时)
 * - life_share: 生活分享 (AI的日常)
 * - anniversary: 纪念日消息
 * - recall: 召回消息 (用户流失风险时)
 * - mood: 情绪分享
 * - tease: 撩拨消息
 */

const mongoose = require('mongoose');

const proactiveMessageSchema = new mongoose.Schema({
  // 目标用户
  userId: { 
    type: String, 
    required: true,
    index: true 
  },
  
  // AI 主播
  agentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Agent',
    required: true,
    index: true
  },
  
  // 消息类型
  type: { 
    type: String, 
    enum: ['greeting', 'missing', 'life_share', 'anniversary', 'recall', 'mood', 'tease'],
    required: true
  },
  
  // 消息内容
  content: { 
    type: String, 
    required: true 
  },
  
  // 附带图片 (可选)
  imageUrl: { type: String },
  
  // 触发条件描述
  triggerReason: { type: String },
  
  // 计划发送时间
  scheduledAt: { 
    type: Date, 
    required: true,
    index: true
  },
  
  // 实际发送时间
  sentAt: { type: Date },
  
  // 状态: pending=待发送, sent=已发送, read=已读, expired=过期
  status: { 
    type: String, 
    enum: ['pending', 'sent', 'read', 'expired'],
    default: 'pending',
    index: true
  },
  
  // 用户是否已读
  readAt: { type: Date },
  
  // 用户是否回复了
  userReplied: { type: Boolean, default: false },
  userRepliedAt: { type: Date },
  
  // 元数据
  metadata: {
    timeOfDay: String,        // morning, noon, afternoon, evening, night
    daysInactive: Number,     // 用户不活跃天数
    intimacyLevel: Number,    // 当时的亲密度
    specialOccasion: String,  // 特殊场合
  },
  
  createdAt: { type: Date, default: Date.now }
});

// 复合索引：快速查询用户的待发送消息
proactiveMessageSchema.index({ userId: 1, agentId: 1, status: 1, scheduledAt: 1 });

// 静态方法：获取用户的待展示消息
proactiveMessageSchema.statics.getPendingMessages = async function(userId, agentId) {
  const now = new Date();
  
  // 获取已到发送时间但未展示的消息
  const messages = await this.find({
    userId,
    agentId,
    status: 'pending',
    scheduledAt: { $lte: now }
  }).sort({ scheduledAt: 1 });
  
  return messages;
};

// 静态方法：标记消息为已发送
proactiveMessageSchema.statics.markAsSent = async function(messageId) {
  return this.findByIdAndUpdate(messageId, {
    status: 'sent',
    sentAt: new Date()
  });
};

// 静态方法：标记消息为已读
proactiveMessageSchema.statics.markAsRead = async function(messageId) {
  return this.findByIdAndUpdate(messageId, {
    status: 'read',
    readAt: new Date()
  });
};

// 静态方法：检查今天是否已发送过某类型消息
proactiveMessageSchema.statics.hasSentToday = async function(userId, agentId, type) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const count = await this.countDocuments({
    userId,
    agentId,
    type,
    createdAt: { $gte: todayStart }
  });
  
  return count > 0;
};

// 静态方法：清理过期消息
proactiveMessageSchema.statics.cleanupExpired = async function() {
  const expireTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24小时前
  
  return this.updateMany(
    {
      status: 'pending',
      scheduledAt: { $lt: expireTime }
    },
    { status: 'expired' }
  );
};

module.exports = mongoose.model('ProactiveMessage', proactiveMessageSchema);
