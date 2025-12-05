const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true },
    userId: { type: String, required: true }, // 用户ID - 用于数据隔离，每个用户有自己的聊天记录
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    audioUrl: { type: String }, // Optional, for assistant voice
    imageUrl: { type: String }, // Optional, for assistant generated image
    inputTokens: { type: Number, default: 0 }, // Token usage tracking
    outputTokens: { type: Number, default: 0 }, // Token usage tracking
    
    // ========== 召回消息相关 (AI自进化系统) ==========
    isRecallMessage: { type: Boolean, default: false }, // 是否是召回消息
    recallMetadata: {
      recallType: String,           // vip_care, miss_you, gentle_nudge, etc.
      daysInactive: Number,         // 用户不活跃天数
      sentAt: Date,                 // 发送时间
      wasRead: { type: Boolean, default: false }, // 是否已读
      userReturned: { type: Boolean, default: false }, // 用户是否回来了
    },
    
    // ========== A/B测试相关 ==========
    experimentId: { type: mongoose.Schema.Types.ObjectId, ref: 'PromptExperiment' },
    variantId: String,
    
    // ========== 主动消息相关 ==========
    isProactive: { type: Boolean, default: false }, // 是否是 AI 主动发送的消息
    proactiveType: { 
      type: String, 
      enum: ['greeting', 'missing', 'life_share', 'anniversary', 'recall', 'mood', 'tease']
    },
    
    createdAt: { type: Date, default: Date.now }
  }
);

// 复合索引：按用户+AI主播+时间快速检索聊天记录
// 这是数据隔离的关键！确保每个用户只能看到自己的聊天记录
MessageSchema.index({ userId: 1, agentId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', MessageSchema);
