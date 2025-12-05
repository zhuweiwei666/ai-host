/**
 * Prompt A/B 测试实验模型 - AI自进化系统 Phase 3
 * 用于测试不同的 Prompt 变体，找出最优版本
 */
const mongoose = require('mongoose');

const PromptExperimentSchema = new mongoose.Schema({
  // ========== 实验基本信息 ==========
  name: { type: String, required: true },
  description: String,
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true, index: true },
  
  // ========== 实验变体 ==========
  variants: [{
    id: { type: String, required: true },       // variant_0, variant_1, ...
    name: String,                                // "更活泼版", "更温柔版"
    prompt: { type: String, required: true },   // Prompt 内容
    allocation: { type: Number, default: 0.5 }, // 流量分配比例 (0-1)
    isControl: { type: Boolean, default: false }, // 是否是对照组
    
    // 指标统计
    metrics: {
      sessions: { type: Number, default: 0 },       // 会话数
      messages: { type: Number, default: 0 },       // 消息数
      avgSessionDuration: { type: Number, default: 0 }, // 平均会话时长
      gifts: { type: Number, default: 0 },          // 送礼次数
      giftValue: { type: Number, default: 0 },      // 送礼金额
      unlocks: { type: Number, default: 0 },        // 解锁次数
      nextDayRetention: { type: Number, default: 0 }, // 次日留存人数
      totalUsers: { type: Number, default: 0 },     // 参与用户数
    },
    
    // 对话质量评分
    qualityScores: {
      avgOverall: { type: Number, default: 0 },
      avgEngagement: { type: Number, default: 0 },
      avgNaturalness: { type: Number, default: 0 },
      sampleCount: { type: Number, default: 0 },
    }
  }],
  
  // ========== 用户分配记录 ==========
  // 记录每个用户被分配到哪个变体（保证一致性）
  userAssignments: {
    type: Map,
    of: String,  // userId -> variantId
    default: {}
  },
  
  // ========== 实验状态 ==========
  status: {
    type: String,
    enum: ['draft', 'running', 'paused', 'completed', 'cancelled'],
    default: 'draft',
    index: true
  },
  
  // ========== 时间控制 ==========
  startedAt: Date,
  endedAt: Date,
  scheduledEndAt: Date,      // 计划结束时间
  minSampleSize: { type: Number, default: 100 }, // 最小样本量
  
  // ========== 结果 ==========
  winner: String,            // 胜出的 variantId
  winnerMetric: String,      // 胜出的关键指标
  confidenceLevel: Number,   // 置信度
  autoApplied: { type: Boolean, default: false }, // 是否已自动应用
  appliedAt: Date,
  
  // ========== 创建信息 ==========
  createdBy: String,
  
}, { timestamps: true });

// ========== 索引 ==========
PromptExperimentSchema.index({ agentId: 1, status: 1 });
PromptExperimentSchema.index({ status: 1, createdAt: -1 });

// ========== 实例方法 ==========

/**
 * 为用户分配变体
 */
PromptExperimentSchema.methods.assignVariant = function(userId) {
  // 检查是否已分配
  if (this.userAssignments.has(userId)) {
    const assignedId = this.userAssignments.get(userId);
    return this.variants.find(v => v.id === assignedId);
  }
  
  // 新用户分配
  const random = Math.random();
  let cumulative = 0;
  
  for (const variant of this.variants) {
    cumulative += variant.allocation;
    if (random < cumulative) {
      this.userAssignments.set(userId, variant.id);
      return variant;
    }
  }
  
  // 默认返回第一个
  const defaultVariant = this.variants[0];
  this.userAssignments.set(userId, defaultVariant.id);
  return defaultVariant;
};

/**
 * 记录指标
 */
PromptExperimentSchema.methods.recordMetric = async function(variantId, metricName, value = 1) {
  const variant = this.variants.find(v => v.id === variantId);
  if (!variant) return;
  
  switch (metricName) {
    case 'session':
      variant.metrics.sessions += 1;
      break;
    case 'message':
      variant.metrics.messages += 1;
      break;
    case 'gift':
      variant.metrics.gifts += 1;
      variant.metrics.giftValue += value;
      break;
    case 'unlock':
      variant.metrics.unlocks += 1;
      break;
    case 'retention':
      variant.metrics.nextDayRetention += 1;
      break;
    case 'sessionDuration':
      // 增量平均
      const n = variant.metrics.sessions || 1;
      variant.metrics.avgSessionDuration = 
        (variant.metrics.avgSessionDuration * (n - 1) + value) / n;
      break;
  }
  
  await this.save();
};

/**
 * 计算变体得分
 */
PromptExperimentSchema.methods.calculateVariantScores = function() {
  return this.variants.map(v => {
    const m = v.metrics;
    
    // 综合得分 = 消息数权重 + 送礼权重 + 留存权重
    const score = 
      (m.messages / Math.max(m.sessions, 1)) * 10 +  // 每会话消息数
      (m.gifts / Math.max(m.totalUsers, 1)) * 50 +   // 人均送礼
      (m.giftValue / Math.max(m.totalUsers, 1)) * 1 + // 人均礼物价值
      (m.nextDayRetention / Math.max(m.totalUsers, 1)) * 100; // 留存率
    
    return {
      id: v.id,
      name: v.name,
      score: Math.round(score * 100) / 100,
      metrics: m,
      qualityScores: v.qualityScores,
    };
  }).sort((a, b) => b.score - a.score);
};

/**
 * 判断实验是否可以结束
 */
PromptExperimentSchema.methods.canConclude = function() {
  // 所有变体都达到最小样本量
  const allReachedMinSample = this.variants.every(
    v => v.metrics.totalUsers >= this.minSampleSize
  );
  
  // 或者已经运行超过7天
  const runningDays = this.startedAt 
    ? (Date.now() - this.startedAt.getTime()) / (24 * 60 * 60 * 1000)
    : 0;
  
  return allReachedMinSample || runningDays >= 7;
};

/**
 * 结束实验并确定赢家
 */
PromptExperimentSchema.methods.conclude = async function() {
  if (this.status !== 'running') return null;
  
  const scores = this.calculateVariantScores();
  
  if (scores.length < 2) return null;
  
  const best = scores[0];
  const second = scores[1];
  
  // 简单的显著性判断（赢家比第二名高10%以上）
  const improvement = (best.score - second.score) / Math.max(second.score, 1);
  
  if (improvement >= 0.1) {
    this.winner = best.id;
    this.winnerMetric = 'composite_score';
    this.confidenceLevel = Math.min(95, 80 + improvement * 100);
  }
  
  this.status = 'completed';
  this.endedAt = new Date();
  
  await this.save();
  
  return {
    winner: this.winner,
    scores,
    improvement: Math.round(improvement * 100),
    confidenceLevel: this.confidenceLevel,
  };
};

// ========== 静态方法 ==========

/**
 * 获取主播当前运行的实验
 */
PromptExperimentSchema.statics.getActiveExperiment = async function(agentId) {
  return this.findOne({ agentId, status: 'running' });
};

/**
 * 创建新实验
 */
PromptExperimentSchema.statics.createExperiment = async function(data) {
  // 确保没有其他运行中的实验
  const existing = await this.findOne({ agentId: data.agentId, status: 'running' });
  if (existing) {
    throw new Error('该主播已有运行中的实验');
  }
  
  const experiment = new this({
    name: data.name,
    description: data.description,
    agentId: data.agentId,
    variants: data.variants.map((v, i) => ({
      id: `variant_${i}`,
      name: v.name || `变体 ${i + 1}`,
      prompt: v.prompt,
      allocation: v.allocation || 1 / data.variants.length,
      isControl: i === 0,
    })),
    minSampleSize: data.minSampleSize || 100,
    createdBy: data.createdBy,
  });
  
  await experiment.save();
  return experiment;
};

module.exports = mongoose.model('PromptExperiment', PromptExperimentSchema);
