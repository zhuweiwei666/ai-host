/**
 * 对话质量分析模型 - AI自进化系统
 * 分析每条AI回复的质量，用于优化Prompt和对话策略
 */
const mongoose = require('mongoose');

const ConversationAnalysisSchema = new mongoose.Schema({
  // ========== 关联信息 ==========
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', index: true },
  userId: { type: String, required: true, index: true },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true, index: true },
  
  // ========== 对话内容 ==========
  conversation: {
    userMessage: String,           // 用户消息（脱敏）
    userMessageLength: Number,
    aiResponse: String,            // AI回复（脱敏）
    aiResponseLength: Number,
    turnNumber: Number,            // 对话轮次
    hasImage: Boolean,             // AI是否发了图片
  },
  
  // ========== 上下文信息 ==========
  context: {
    intimacy: Number,              // 当时的亲密度
    userType: String,              // direct/slow_burn/unknown
    stage: Number,                 // 当前阶段 1-5
    detectionRound: Number,        // 类型检测轮次
    systemPromptVersion: String,   // 使用的Prompt版本
  },
  
  // ========== AI评估的质量分 ==========
  scores: {
    relevance: { type: Number, min: 0, max: 10 },        // 相关性：是否回应了用户
    naturalness: { type: Number, min: 0, max: 10 },      // 自然度：是否像真人
    engagement: { type: Number, min: 0, max: 10 },       // 吸引力：是否能吸引继续
    emotionalMatch: { type: Number, min: 0, max: 10 },   // 情感匹配：共情能力
    paceAppropriate: { type: Number, min: 0, max: 10 },  // 节奏合适：不太快/太慢
    characterConsistent: { type: Number, min: 0, max: 10 }, // 人设一致性
    overall: { type: Number, min: 0, max: 10 },          // 综合分
  },
  
  // ========== 用户实际反应 ==========
  userReaction: {
    responded: Boolean,            // 是否回复了
    responseTime: Number,          // 回复时间(秒)
    responseLength: Number,        // 回复长度
    responseType: String,          // positive/neutral/negative/left
    
    // 后续行为
    continuedConversation: Boolean, // 是否继续对话
    messagesAfter: Number,          // 之后发了多少消息
    sentGiftAfter: Boolean,         // 之后是否送礼
    leftImmediately: Boolean,       // 是否立即离开
    sessionEndedAfter: Boolean,     // 是否结束会话
  },
  
  // ========== 问题标记 ==========
  issues: [{
    type: { 
      type: String,
      enum: [
        'too_sexual',           // 太色情
        'too_cold',             // 太冷淡
        'off_character',        // 不符合人设
        'irrelevant',           // 答非所问
        'repetitive',           // 重复
        'too_long',             // 太长
        'too_short',            // 太短
        'awkward',              // 尴尬/不自然
        'boundary_violation',   // 越界
        'pacing_too_fast',      // 进展太快
        'pacing_too_slow',      // 进展太慢
      ]
    },
    severity: { 
      type: String, 
      enum: ['low', 'medium', 'high'],
      default: 'low'
    },
    description: String,
  }],
  
  // ========== 优化建议 ==========
  suggestion: String,              // AI给出的改进建议
  suggestedResponse: String,       // 建议的更好回复
  
  // ========== 评估状态 ==========
  evaluationStatus: {
    type: String,
    enum: ['pending', 'evaluated', 'skipped', 'error'],
    default: 'pending'
  },
  evaluatedAt: Date,
  evaluationModel: String,         // 使用的评估模型
  
  // ========== 标记 ==========
  flaggedForReview: { type: Boolean, default: false },
  reviewedBy: String,
  reviewedAt: Date,
  reviewNotes: String,
  
}, { timestamps: true });

// ========== 索引 ==========
ConversationAnalysisSchema.index({ agentId: 1, createdAt: -1 });
ConversationAnalysisSchema.index({ userId: 1, agentId: 1, createdAt: -1 });
ConversationAnalysisSchema.index({ evaluationStatus: 1, createdAt: -1 });
ConversationAnalysisSchema.index({ 'scores.overall': 1 });
ConversationAnalysisSchema.index({ 'issues.type': 1 });

// ========== 实例方法 ==========

/**
 * 记录用户反应
 */
ConversationAnalysisSchema.methods.recordUserReaction = async function(reaction) {
  this.userReaction = {
    ...this.userReaction,
    ...reaction
  };
  await this.save();
};

/**
 * 添加问题标记
 */
ConversationAnalysisSchema.methods.addIssue = async function(type, severity = 'low', description = '') {
  this.issues.push({ type, severity, description });
  
  // 高严重度自动标记需要人工审核
  if (severity === 'high') {
    this.flaggedForReview = true;
  }
  
  await this.save();
};

// ========== 静态方法 ==========

/**
 * 获取待评估的对话
 */
ConversationAnalysisSchema.statics.getPendingEvaluations = async function(limit = 100) {
  return this.find({ evaluationStatus: 'pending' })
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();
};

/**
 * 获取主播的问题统计
 */
ConversationAnalysisSchema.statics.getIssueStats = async function(agentId, days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const stats = await this.aggregate([
    {
      $match: {
        agentId: new mongoose.Types.ObjectId(agentId),
        createdAt: { $gte: since },
        'issues.0': { $exists: true }
      }
    },
    { $unwind: '$issues' },
    {
      $group: {
        _id: '$issues.type',
        count: { $sum: 1 },
        highSeverity: {
          $sum: { $cond: [{ $eq: ['$issues.severity', 'high'] }, 1, 0] }
        }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  return stats;
};

/**
 * 获取主播的平均评分
 */
ConversationAnalysisSchema.statics.getAverageScores = async function(agentId, days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const result = await this.aggregate([
    {
      $match: {
        agentId: new mongoose.Types.ObjectId(agentId),
        createdAt: { $gte: since },
        evaluationStatus: 'evaluated'
      }
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        avgRelevance: { $avg: '$scores.relevance' },
        avgNaturalness: { $avg: '$scores.naturalness' },
        avgEngagement: { $avg: '$scores.engagement' },
        avgEmotionalMatch: { $avg: '$scores.emotionalMatch' },
        avgPaceAppropriate: { $avg: '$scores.paceAppropriate' },
        avgCharacterConsistent: { $avg: '$scores.characterConsistent' },
        avgOverall: { $avg: '$scores.overall' },
      }
    }
  ]);
  
  return result[0] || null;
};

/**
 * 获取用户反应统计
 */
ConversationAnalysisSchema.statics.getUserReactionStats = async function(agentId, days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const result = await this.aggregate([
    {
      $match: {
        agentId: new mongoose.Types.ObjectId(agentId),
        createdAt: { $gte: since },
        'userReaction.responded': { $exists: true }
      }
    },
    {
      $group: {
        _id: null,
        totalMessages: { $sum: 1 },
        responseRate: { $avg: { $cond: ['$userReaction.responded', 1, 0] } },
        avgResponseTime: { $avg: '$userReaction.responseTime' },
        leftImmediatelyRate: { $avg: { $cond: ['$userReaction.leftImmediately', 1, 0] } },
        giftAfterRate: { $avg: { $cond: ['$userReaction.sentGiftAfter', 1, 0] } },
      }
    }
  ]);
  
  return result[0] || null;
};

/**
 * 获取需要优化的对话样本
 */
ConversationAnalysisSchema.statics.getLowScoreSamples = async function(agentId, limit = 20) {
  return this.find({
    agentId,
    evaluationStatus: 'evaluated',
    'scores.overall': { $lt: 6 }
  })
    .sort({ 'scores.overall': 1 })
    .limit(limit)
    .lean();
};

module.exports = mongoose.model('ConversationAnalysis', ConversationAnalysisSchema);
