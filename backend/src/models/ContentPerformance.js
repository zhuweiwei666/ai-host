/**
 * 内容表现追踪模型 - AI自进化系统
 * 追踪每个内容（图片/视频/Outfit）的表现数据
 * 用于自动评分、优化和淘汰
 */
const mongoose = require('mongoose');

const ContentPerformanceSchema = new mongoose.Schema({
  // ========== 内容标识 ==========
  contentId: { type: String, required: true, unique: true, index: true },
  contentType: { 
    type: String, 
    required: true,
    enum: ['image', 'video', 'outfit', 'message_image', 'avatar']
  },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true, index: true },
  
  // ========== 内容元数据 ==========
  meta: {
    url: String,                   // 内容URL
    prompt: String,                // 生成时用的prompt
    level: Number,                 // 尺度等级 1-5
    tags: [String],                // 标签
    category: String,              // 分类（居家、性感、暴露等）
    generatedAt: Date,             // 生成时间
    generatedBy: String,           // 生成方式（manual/auto/ai）
    referenceImageId: String,      // 参考图片ID
  },
  
  // ========== 曝光指标 ==========
  exposure: {
    impressions: { type: Number, default: 0 },      // 曝光次数
    uniqueViews: { type: Number, default: 0 },      // 独立访客
    viewerIds: [String],                            // 访客ID列表（用于去重，定期清理）
  },
  
  // ========== 互动指标 ==========
  engagement: {
    // 观看
    totalViewDuration: { type: Number, default: 0 }, // 总观看时长(秒)
    avgViewDuration: { type: Number, default: 0 },   // 平均观看时长
    maxViewDuration: { type: Number, default: 0 },   // 最长观看时长
    
    // 视频特有
    completionRate: { type: Number, default: 0 },    // 完播率 0-100
    avgWatchProgress: { type: Number, default: 0 },  // 平均观看进度
    
    // 互动
    saves: { type: Number, default: 0 },             // 保存次数
    shares: { type: Number, default: 0 },            // 分享次数
    likes: { type: Number, default: 0 },             // 点赞
    dislikes: { type: Number, default: 0 },          // 不喜欢
    
    // 解锁（Outfit特有）
    unlocks: { type: Number, default: 0 },           // 解锁次数
    unlockRate: { type: Number, default: 0 },        // 解锁率
  },
  
  // ========== 转化指标 ==========
  conversion: {
    triggeredGifts: { type: Number, default: 0 },    // 触发送礼次数
    giftValue: { type: Number, default: 0 },         // 触发的礼物总价值
    triggeredPurchases: { type: Number, default: 0 },// 触发充值次数
    purchaseValue: { type: Number, default: 0 },     // 触发的充值总额
    triggeredMessages: { type: Number, default: 0 }, // 触发的消息数
    revenue: { type: Number, default: 0 },           // 直接产生的收入
  },
  
  // ========== 留存指标 ==========
  retention: {
    returnRate: { type: Number, default: 0 },        // 看过内容后的回访率
    nextDayReturn: { type: Number, default: 0 },     // 次日回访率
    weeklyReturn: { type: Number, default: 0 },      // 周回访率
    avgSessionsAfter: { type: Number, default: 0 },  // 之后的平均会话数
  },
  
  // ========== AI 质量评分 ==========
  qualityScore: {
    overall: { type: Number, default: 50 },          // 综合分 0-100
    engagement: { type: Number, default: 50 },       // 互动分 0-100
    conversion: { type: Number, default: 50 },       // 转化分 0-100
    retention: { type: Number, default: 50 },        // 留存分 0-100
    trend: { type: String, default: 'stable' },      // rising/stable/declining
    lastCalculated: Date,
  },
  
  // ========== 历史评分记录 ==========
  scoreHistory: [{
    date: Date,
    overall: Number,
    engagement: Number,
    conversion: Number,
    retention: Number,
  }],
  
  // ========== 状态管理 ==========
  status: { 
    type: String, 
    enum: ['active', 'underperforming', 'deprecated', 'flagged', 'testing'],
    default: 'active',
    index: true
  },
  statusReason: String,            // 状态变更原因
  statusChangedAt: Date,
  
  // ========== 优化建议 ==========
  optimization: {
    suggestedAction: String,       // keep/improve/replace/remove
    suggestedPrompt: String,       // AI建议的新prompt
    suggestedTags: [String],       // 建议的标签
    lastAnalyzed: Date,
  },
  
}, { timestamps: true });

// ========== 索引 ==========
ContentPerformanceSchema.index({ agentId: 1, status: 1 });
ContentPerformanceSchema.index({ 'qualityScore.overall': 1 });
ContentPerformanceSchema.index({ contentType: 1, status: 1 });

// ========== 实例方法 ==========

/**
 * 记录一次曝光
 */
ContentPerformanceSchema.methods.recordView = async function(userId, duration = 0) {
  this.exposure.impressions += 1;
  
  // 去重统计
  if (!this.exposure.viewerIds.includes(userId)) {
    this.exposure.viewerIds.push(userId);
    this.exposure.uniqueViews += 1;
    
    // 防止数组过大，只保留最近1000个
    if (this.exposure.viewerIds.length > 1000) {
      this.exposure.viewerIds = this.exposure.viewerIds.slice(-1000);
    }
  }
  
  // 更新观看时长
  if (duration > 0) {
    this.engagement.totalViewDuration += duration;
    this.engagement.avgViewDuration = 
      this.engagement.totalViewDuration / this.exposure.impressions;
    this.engagement.maxViewDuration = 
      Math.max(this.engagement.maxViewDuration, duration);
  }
  
  await this.save();
};

/**
 * 记录互动
 */
ContentPerformanceSchema.methods.recordInteraction = async function(type, data = {}) {
  switch (type) {
    case 'save':
      this.engagement.saves += 1;
      break;
    case 'share':
      this.engagement.shares += 1;
      break;
    case 'like':
      this.engagement.likes += 1;
      break;
    case 'dislike':
      this.engagement.dislikes += 1;
      break;
    case 'unlock':
      this.engagement.unlocks += 1;
      this.engagement.unlockRate = 
        this.exposure.uniqueViews > 0 
          ? (this.engagement.unlocks / this.exposure.uniqueViews) * 100 
          : 0;
      break;
    case 'video_complete':
      if (data.progress) {
        const prevTotal = this.engagement.avgWatchProgress * (this.exposure.impressions - 1);
        this.engagement.avgWatchProgress = (prevTotal + data.progress) / this.exposure.impressions;
        if (data.progress >= 90) {
          this.engagement.completionRate = 
            ((this.engagement.completionRate * (this.exposure.impressions - 1)) + 100) / 
            this.exposure.impressions;
        }
      }
      break;
  }
  
  await this.save();
};

/**
 * 记录转化
 */
ContentPerformanceSchema.methods.recordConversion = async function(type, value = 0) {
  switch (type) {
    case 'gift':
      this.conversion.triggeredGifts += 1;
      this.conversion.giftValue += value;
      this.conversion.revenue += value;
      break;
    case 'purchase':
      this.conversion.triggeredPurchases += 1;
      this.conversion.purchaseValue += value;
      break;
    case 'message':
      this.conversion.triggeredMessages += 1;
      break;
  }
  
  await this.save();
};

/**
 * 计算质量分
 */
ContentPerformanceSchema.methods.calculateScore = async function() {
  const { exposure, engagement, conversion } = this;
  
  // 曝光量太少，不计算
  if (exposure.uniqueViews < 10) {
    return this.qualityScore;
  }
  
  // 互动分 (40权重)
  const saveRate = exposure.uniqueViews > 0 ? engagement.saves / exposure.uniqueViews : 0;
  const likeRate = (engagement.likes + engagement.dislikes) > 0 
    ? engagement.likes / (engagement.likes + engagement.dislikes) 
    : 0.5;
  const durationScore = Math.min(engagement.avgViewDuration / 30, 1); // 30秒满分
  
  const engagementScore = Math.min(100, (saveRate * 200 + likeRate * 50 + durationScore * 50));
  
  // 转化分 (35权重)
  const giftRate = exposure.uniqueViews > 0 ? conversion.triggeredGifts / exposure.uniqueViews : 0;
  const purchaseRate = exposure.uniqueViews > 0 ? conversion.triggeredPurchases / exposure.uniqueViews : 0;
  
  const conversionScore = Math.min(100, (giftRate * 500 + purchaseRate * 1000));
  
  // 留存分 (25权重) - 需要外部计算
  const retentionScore = this.qualityScore.retention || 50;
  
  // 综合分
  const overall = engagementScore * 0.4 + conversionScore * 0.35 + retentionScore * 0.25;
  
  // 计算趋势
  let trend = 'stable';
  if (this.scoreHistory.length >= 3) {
    const recent = this.scoreHistory.slice(-3);
    const avgRecent = recent.reduce((a, b) => a + b.overall, 0) / 3;
    if (overall > avgRecent * 1.1) trend = 'rising';
    else if (overall < avgRecent * 0.9) trend = 'declining';
  }
  
  // 更新评分
  this.qualityScore = {
    overall: Math.round(overall),
    engagement: Math.round(engagementScore),
    conversion: Math.round(conversionScore),
    retention: Math.round(retentionScore),
    trend,
    lastCalculated: new Date(),
  };
  
  // 记录历史
  this.scoreHistory.push({
    date: new Date(),
    overall: this.qualityScore.overall,
    engagement: this.qualityScore.engagement,
    conversion: this.qualityScore.conversion,
    retention: this.qualityScore.retention,
  });
  
  // 只保留最近30条记录
  if (this.scoreHistory.length > 30) {
    this.scoreHistory = this.scoreHistory.slice(-30);
  }
  
  // 自动更新状态
  if (this.qualityScore.overall < 25 && exposure.uniqueViews >= 100) {
    this.status = 'underperforming';
    this.statusReason = `质量分过低: ${this.qualityScore.overall}`;
    this.statusChangedAt = new Date();
  }
  
  await this.save();
  return this.qualityScore;
};

// ========== 静态方法 ==========

/**
 * 获取或创建内容表现记录
 */
ContentPerformanceSchema.statics.getOrCreate = async function(contentId, contentType, agentId, meta = {}) {
  let perf = await this.findOne({ contentId });
  
  if (!perf) {
    perf = new this({
      contentId,
      contentType,
      agentId,
      meta: {
        ...meta,
        generatedAt: new Date(),
      }
    });
    await perf.save();
  }
  
  return perf;
};

/**
 * 获取主播的内容表现排行
 */
ContentPerformanceSchema.statics.getAgentLeaderboard = async function(agentId, limit = 20) {
  return this.find({ 
    agentId, 
    status: 'active',
    'exposure.uniqueViews': { $gte: 10 }
  })
    .sort({ 'qualityScore.overall': -1 })
    .limit(limit)
    .lean();
};

/**
 * 获取表现不佳的内容
 */
ContentPerformanceSchema.statics.getUnderperforming = async function(agentId = null, threshold = 30) {
  const query = {
    'qualityScore.overall': { $lt: threshold },
    'exposure.uniqueViews': { $gte: 50 },
    status: 'active'
  };
  
  if (agentId) query.agentId = agentId;
  
  return this.find(query).lean();
};

module.exports = mongoose.model('ContentPerformance', ContentPerformanceSchema);
