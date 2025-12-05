/**
 * 告警规则配置模型 - AI自进化系统 Phase 4
 * 定义告警触发条件
 */
const mongoose = require('mongoose');

const AlertRuleSchema = new mongoose.Schema({
  // ========== 规则基本信息 ==========
  name: { type: String, required: true },
  description: String,
  type: {
    type: String,
    enum: [
      'churn_risk',
      'high_value_churn',
      'conversation_quality',
      'content_underperform',
      'revenue_drop',
      'engagement_drop',
      'system_error',
    ],
    required: true,
  },
  
  // ========== 触发条件 ==========
  conditions: {
    metric: { type: String, required: true },  // 监控指标
    operator: { 
      type: String, 
      enum: ['gt', 'lt', 'gte', 'lte', 'eq', 'change_gt', 'change_lt'],
      required: true 
    },
    threshold: { type: Number, required: true },
    timeWindow: { type: Number, default: 24 }, // 时间窗口（小时）
    minSampleSize: { type: Number, default: 10 }, // 最小样本量
  },
  
  // ========== 过滤条件 ==========
  filters: {
    agentIds: [mongoose.Schema.Types.ObjectId],  // 限定主播
    userSegments: [String],  // 用户分群 ['whale', 'dolphin', ...]
    minIntimacy: Number,
    minLTV: Number,
  },
  
  // ========== 告警配置 ==========
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'warning',
  },
  
  // ========== 通知配置 ==========
  notifications: {
    channels: [{
      type: { type: String, enum: ['email', 'webhook', 'wechat', 'slack'] },
      target: String,  // 邮箱/URL/ID
      enabled: { type: Boolean, default: true },
    }],
    cooldown: { type: Number, default: 60 }, // 通知冷却（分钟）
    maxPerDay: { type: Number, default: 10 }, // 每日最大通知数
  },
  
  // ========== 状态 ==========
  enabled: { type: Boolean, default: true, index: true },
  lastTriggeredAt: Date,
  triggerCount: { type: Number, default: 0 },
  
  // ========== 创建信息 ==========
  createdBy: String,
  
}, { timestamps: true });

// ========== 默认规则 ==========
AlertRuleSchema.statics.getDefaultRules = function() {
  return [
    {
      name: '高价值用户流失预警',
      description: '当高LTV用户3天未活跃时告警',
      type: 'high_value_churn',
      conditions: {
        metric: 'days_inactive',
        operator: 'gte',
        threshold: 3,
        timeWindow: 24,
      },
      filters: {
        userSegments: ['whale', 'dolphin'],
      },
      severity: 'critical',
      notifications: {
        channels: [{ type: 'webhook', target: '', enabled: false }],
        cooldown: 60,
        maxPerDay: 20,
      },
    },
    {
      name: '普通用户流失预警',
      description: '当用户7天未活跃时告警',
      type: 'churn_risk',
      conditions: {
        metric: 'days_inactive',
        operator: 'gte',
        threshold: 7,
        timeWindow: 24,
      },
      severity: 'warning',
      notifications: {
        channels: [{ type: 'webhook', target: '', enabled: false }],
        cooldown: 120,
        maxPerDay: 50,
      },
    },
    {
      name: '对话质量下降',
      description: '当AI对话评分低于60分时告警',
      type: 'conversation_quality',
      conditions: {
        metric: 'avg_conversation_score',
        operator: 'lt',
        threshold: 60,
        timeWindow: 24,
        minSampleSize: 20,
      },
      severity: 'warning',
      notifications: {
        channels: [{ type: 'webhook', target: '', enabled: false }],
        cooldown: 240,
        maxPerDay: 5,
      },
    },
    {
      name: '内容表现异常',
      description: '当内容质量分低于40时告警',
      type: 'content_underperform',
      conditions: {
        metric: 'content_quality_score',
        operator: 'lt',
        threshold: 40,
        timeWindow: 48,
        minSampleSize: 100,
      },
      severity: 'info',
      notifications: {
        channels: [{ type: 'webhook', target: '', enabled: false }],
        cooldown: 480,
        maxPerDay: 3,
      },
    },
    {
      name: '日收入下降',
      description: '当日收入较昨日下降超过30%时告警',
      type: 'revenue_drop',
      conditions: {
        metric: 'daily_revenue_change',
        operator: 'change_lt',
        threshold: -30,
        timeWindow: 24,
      },
      severity: 'critical',
      notifications: {
        channels: [{ type: 'webhook', target: '', enabled: false }],
        cooldown: 1440,
        maxPerDay: 1,
      },
    },
    {
      name: '用户活跃度下降',
      description: '当日活跃用户较上周同期下降超过20%时告警',
      type: 'engagement_drop',
      conditions: {
        metric: 'dau_change',
        operator: 'change_lt',
        threshold: -20,
        timeWindow: 24,
      },
      severity: 'warning',
      notifications: {
        channels: [{ type: 'webhook', target: '', enabled: false }],
        cooldown: 1440,
        maxPerDay: 1,
      },
    },
  ];
};

/**
 * 初始化默认规则
 */
AlertRuleSchema.statics.initializeDefaults = async function() {
  const existingCount = await this.countDocuments();
  if (existingCount > 0) {
    console.log('[AlertRule] 规则已存在，跳过初始化');
    return;
  }
  
  const defaults = this.getDefaultRules();
  await this.insertMany(defaults);
  console.log(`[AlertRule] 初始化了 ${defaults.length} 条默认规则`);
};

/**
 * 获取启用的规则
 */
AlertRuleSchema.statics.getEnabledRules = async function(type = null) {
  const query = { enabled: true };
  if (type) query.type = type;
  return this.find(query).lean();
};

module.exports = mongoose.model('AlertRule', AlertRuleSchema);
