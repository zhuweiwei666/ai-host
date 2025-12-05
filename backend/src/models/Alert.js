/**
 * 告警模型 - AI自进化系统 Phase 4
 * 管理系统告警和通知
 */
const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  // ========== 告警基本信息 ==========
  type: {
    type: String,
    enum: [
      'churn_risk',           // 流失风险
      'high_value_churn',     // 高价值用户流失
      'conversation_quality', // 对话质量下降
      'content_underperform', // 内容表现差
      'revenue_drop',         // 收入下降
      'engagement_drop',      // 互动下降
      'system_error',         // 系统错误
      'task_failure',         // 任务失败
      'ab_test_complete',     // A/B测试完成
      'recall_success',       // 召回成功
    ],
    required: true,
    index: true,
  },
  
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'warning',
    index: true,
  },
  
  title: { type: String, required: true },
  message: { type: String, required: true },
  
  // ========== 关联信息 ==========
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  userId: String,
  relatedId: String,  // 关联的其他ID（实验ID、内容ID等）
  
  // ========== 告警数据 ==========
  data: {
    metric: String,         // 指标名称
    currentValue: Number,   // 当前值
    threshold: Number,      // 阈值
    changePercent: Number,  // 变化百分比
    affectedUsers: Number,  // 影响用户数
    details: mongoose.Schema.Types.Mixed,
  },
  
  // ========== 状态管理 ==========
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved', 'ignored'],
    default: 'active',
    index: true,
  },
  
  acknowledgedBy: String,
  acknowledgedAt: Date,
  resolvedBy: String,
  resolvedAt: Date,
  resolution: String,      // 解决方案说明
  
  // ========== 通知记录 ==========
  notifications: [{
    channel: { type: String, enum: ['email', 'webhook', 'wechat', 'slack'] },
    sentAt: Date,
    success: Boolean,
    error: String,
  }],
  
  // ========== 去重 ==========
  fingerprint: { type: String, index: true }, // 用于去重的指纹
  duplicateCount: { type: Number, default: 1 },
  firstOccurredAt: Date,
  lastOccurredAt: Date,
  
}, { timestamps: true });

// ========== 索引 ==========
AlertSchema.index({ type: 1, status: 1, createdAt: -1 });
AlertSchema.index({ agentId: 1, status: 1 });
AlertSchema.index({ severity: 1, status: 1 });

// ========== 静态方法 ==========

/**
 * 创建或更新告警（去重）
 */
AlertSchema.statics.createOrUpdate = async function(alertData) {
  const fingerprint = this.generateFingerprint(alertData);
  
  // 查找24小时内的相同告警
  const existing = await this.findOne({
    fingerprint,
    status: { $in: ['active', 'acknowledged'] },
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  });
  
  if (existing) {
    // 更新计数
    existing.duplicateCount += 1;
    existing.lastOccurredAt = new Date();
    existing.data = alertData.data; // 更新最新数据
    await existing.save();
    return { alert: existing, isNew: false };
  }
  
  // 创建新告警
  const alert = new this({
    ...alertData,
    fingerprint,
    firstOccurredAt: new Date(),
    lastOccurredAt: new Date(),
  });
  
  await alert.save();
  return { alert, isNew: true };
};

/**
 * 生成告警指纹
 */
AlertSchema.statics.generateFingerprint = function(alertData) {
  const parts = [
    alertData.type,
    alertData.agentId || 'global',
    alertData.userId || 'all',
    alertData.data?.metric || 'default',
  ];
  return parts.join(':');
};

/**
 * 获取活跃告警统计
 */
AlertSchema.statics.getActiveStats = async function() {
  const stats = await this.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: { type: '$type', severity: '$severity' },
        count: { $sum: 1 },
      }
    }
  ]);
  
  const result = {
    total: 0,
    bySeverity: { info: 0, warning: 0, critical: 0 },
    byType: {},
  };
  
  for (const stat of stats) {
    result.total += stat.count;
    result.bySeverity[stat._id.severity] += stat.count;
    
    if (!result.byType[stat._id.type]) {
      result.byType[stat._id.type] = 0;
    }
    result.byType[stat._id.type] += stat.count;
  }
  
  return result;
};

/**
 * 获取最近告警
 */
AlertSchema.statics.getRecent = async function(limit = 50, filters = {}) {
  const query = {};
  
  if (filters.status) query.status = filters.status;
  if (filters.severity) query.severity = filters.severity;
  if (filters.type) query.type = filters.type;
  if (filters.agentId) query.agentId = filters.agentId;
  
  return this.find(query)
    .populate('agentId', 'name')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * 批量确认告警
 */
AlertSchema.statics.acknowledgeMany = async function(alertIds, acknowledgedBy) {
  return this.updateMany(
    { _id: { $in: alertIds }, status: 'active' },
    {
      status: 'acknowledged',
      acknowledgedBy,
      acknowledgedAt: new Date(),
    }
  );
};

/**
 * 解决告警
 */
AlertSchema.statics.resolve = async function(alertId, resolvedBy, resolution) {
  return this.findByIdAndUpdate(alertId, {
    status: 'resolved',
    resolvedBy,
    resolvedAt: new Date(),
    resolution,
  }, { new: true });
};

module.exports = mongoose.model('Alert', AlertSchema);
