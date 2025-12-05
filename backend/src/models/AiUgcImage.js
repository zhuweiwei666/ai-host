const mongoose = require('mongoose');

/**
 * AI UGC 相册模型
 * 存储每个主播的 AI 生成图片，用于复用减少 API 调用成本
 */
const AiUgcImageSchema = new mongoose.Schema({
  // 所属主播
  agentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Agent', 
    required: true,
    index: true
  },
  
  // 图片 URL
  imageUrl: { 
    type: String, 
    required: true 
  },
  
  // 生成时的 prompt（运营参考用）
  prompt: { 
    type: String, 
    default: '' 
  },
  
  // 原始生成者的用户 ID（不再发给此用户）
  generatedByUserId: { 
    type: String, 
    default: null 
  },
  
  // 已发送给哪些用户（确保每人看到的不重复）
  sentToUserIds: { 
    type: [String], 
    default: [] 
  },
  
  // 是否为 NSFW 内容（Stage 3 专用）
  isNsfw: { 
    type: Boolean, 
    default: false 
  },
  
  // 是否启用（运营可禁用/删除）
  isActive: { 
    type: Boolean, 
    default: true 
  },
  
  // 使用次数统计
  usageCount: {
    type: Number,
    default: 0
  }
}, { 
  timestamps: true 
});

// 复合索引：快速查询某主播的可用图片
AiUgcImageSchema.index({ agentId: 1, isActive: 1, isNsfw: 1 });

// 索引：按创建时间排序（用于淘汰最旧的）
AiUgcImageSchema.index({ agentId: 1, createdAt: 1 });

module.exports = mongoose.model('AiUgcImage', AiUgcImageSchema);
