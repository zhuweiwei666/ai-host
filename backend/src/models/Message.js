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
    createdAt: { type: Date, default: Date.now }
  }
);

// 复合索引：按用户+AI主播+时间快速检索聊天记录
// 这是数据隔离的关键！确保每个用户只能看到自己的聊天记录
MessageSchema.index({ userId: 1, agentId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', MessageSchema);
