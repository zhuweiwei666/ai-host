/**
 * 内容分析服务 - AI自进化系统
 * 分析内容质量、识别表现不佳的内容、生成优化建议
 */
const ContentPerformance = require('../models/ContentPerformance');
const UserEvent = require('../models/UserEvent');
const Agent = require('../models/Agent');

class ContentAnalyzer {
  
  /**
   * 更新所有活跃内容的质量分
   */
  async updateAllScores() {
    console.log('[ContentAnalyzer] 开始更新内容质量分...');
    
    const activeContents = await ContentPerformance.find({ 
      status: 'active',
      'exposure.uniqueViews': { $gte: 10 } // 至少10次曝光才计算
    });
    
    let updated = 0;
    for (const content of activeContents) {
      try {
        await content.calculateScore();
        updated++;
      } catch (err) {
        console.error(`[ContentAnalyzer] 更新内容 ${content.contentId} 失败:`, err.message);
      }
    }
    
    console.log(`[ContentAnalyzer] 更新完成: ${updated}/${activeContents.length}`);
    return updated;
  }
  
  /**
   * 更新最近活跃内容的分数（增量更新）
   */
  async updateRecentScores(hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    // 找到最近有互动的内容
    const recentContentIds = await UserEvent.distinct('data.contentId', {
      eventType: { $in: ['image_viewed', 'video_played', 'content_liked', 'content_disliked'] },
      serverTimestamp: { $gte: since }
    });
    
    console.log(`[ContentAnalyzer] 更新 ${recentContentIds.length} 个最近活跃内容...`);
    
    let updated = 0;
    for (const contentId of recentContentIds) {
      if (!contentId) continue;
      
      const content = await ContentPerformance.findOne({ contentId });
      if (content && content.status === 'active') {
        try {
          await content.calculateScore();
          updated++;
        } catch (err) {
          console.error(`[ContentAnalyzer] 更新内容 ${contentId} 失败:`, err.message);
        }
      }
    }
    
    return updated;
  }
  
  /**
   * 识别表现不佳的内容
   */
  async identifyUnderperformingContent(threshold = 30, minViews = 50) {
    const underperforming = await ContentPerformance.find({
      'qualityScore.overall': { $lt: threshold },
      'exposure.uniqueViews': { $gte: minViews },
      status: 'active'
    }).populate('agentId', 'name');
    
    console.log(`[ContentAnalyzer] 发现 ${underperforming.length} 个表现不佳的内容`);
    return underperforming;
  }
  
  /**
   * 自动标记表现不佳的内容
   */
  async deprecateUnderperforming(threshold = 25, minViews = 100) {
    const result = await ContentPerformance.updateMany(
      {
        'qualityScore.overall': { $lt: threshold },
        'exposure.uniqueViews': { $gte: minViews },
        status: 'active'
      },
      { 
        status: 'underperforming',
        statusReason: `质量分低于 ${threshold}`,
        statusChangedAt: new Date()
      }
    );
    
    console.log(`[ContentAnalyzer] 标记 ${result.modifiedCount} 个内容为表现不佳`);
    return result.modifiedCount;
  }
  
  /**
   * 获取主播的内容表现概览
   */
  async getAgentContentOverview(agentId) {
    const [
      total,
      active,
      underperforming,
      avgScore,
      topContent,
      bottomContent
    ] = await Promise.all([
      ContentPerformance.countDocuments({ agentId }),
      ContentPerformance.countDocuments({ agentId, status: 'active' }),
      ContentPerformance.countDocuments({ agentId, status: 'underperforming' }),
      ContentPerformance.aggregate([
        { $match: { agentId, status: 'active', 'exposure.uniqueViews': { $gte: 10 } } },
        { $group: { _id: null, avg: { $avg: '$qualityScore.overall' } } }
      ]).then(r => r[0]?.avg || 0),
      ContentPerformance.find({ agentId, status: 'active' })
        .sort({ 'qualityScore.overall': -1 })
        .limit(5)
        .lean(),
      ContentPerformance.find({ agentId, status: 'active', 'exposure.uniqueViews': { $gte: 10 } })
        .sort({ 'qualityScore.overall': 1 })
        .limit(5)
        .lean()
    ]);
    
    return {
      total,
      active,
      underperforming,
      avgScore: Math.round(avgScore),
      topContent,
      bottomContent
    };
  }
  
  /**
   * 分析成功内容的共同特征
   */
  async analyzeSuccessPatterns(agentId, minScore = 70) {
    const topContent = await ContentPerformance.find({
      agentId,
      status: 'active',
      'qualityScore.overall': { $gte: minScore }
    }).lean();
    
    if (topContent.length === 0) return null;
    
    // 分析标签频率
    const tagFreq = {};
    const levelDist = {};
    let totalViews = 0;
    let totalDuration = 0;
    
    topContent.forEach(c => {
      // 标签统计
      (c.meta?.tags || []).forEach(tag => {
        tagFreq[tag] = (tagFreq[tag] || 0) + 1;
      });
      
      // 等级分布
      const level = c.meta?.level || 'unknown';
      levelDist[level] = (levelDist[level] || 0) + 1;
      
      // 平均数据
      totalViews += c.exposure?.uniqueViews || 0;
      totalDuration += c.engagement?.avgViewDuration || 0;
    });
    
    // 排序标签
    const topTags = Object.entries(tagFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));
    
    return {
      sampleSize: topContent.length,
      topTags,
      levelDistribution: levelDist,
      avgViews: Math.round(totalViews / topContent.length),
      avgDuration: Math.round(totalDuration / topContent.length)
    };
  }
  
  /**
   * 生成每日内容报告
   */
  async generateDailyReport() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    // 获取各主播的内容表现
    const agents = await Agent.find({ status: 'active' });
    const agentReports = [];
    
    for (const agent of agents) {
      const overview = await this.getAgentContentOverview(agent._id);
      
      // 今日事件统计
      const todayEvents = await UserEvent.aggregate([
        {
          $match: {
            agentId: agent._id,
            serverTimestamp: { $gte: yesterday },
            eventType: { $in: ['image_viewed', 'video_played', 'content_liked', 'gift_sent'] }
          }
        },
        {
          $group: {
            _id: '$eventType',
            count: { $sum: 1 }
          }
        }
      ]);
      
      agentReports.push({
        agentId: agent._id,
        agentName: agent.name,
        ...overview,
        todayEvents: todayEvents.reduce((acc, e) => {
          acc[e._id] = e.count;
          return acc;
        }, {})
      });
    }
    
    // 全局统计
    const globalStats = {
      totalContent: await ContentPerformance.countDocuments(),
      activeContent: await ContentPerformance.countDocuments({ status: 'active' }),
      underperformingContent: await ContentPerformance.countDocuments({ status: 'underperforming' }),
      avgQualityScore: await ContentPerformance.aggregate([
        { $match: { status: 'active', 'exposure.uniqueViews': { $gte: 10 } } },
        { $group: { _id: null, avg: { $avg: '$qualityScore.overall' } } }
      ]).then(r => Math.round(r[0]?.avg || 0))
    };
    
    return {
      date: today.toISOString().split('T')[0],
      globalStats,
      agentReports,
      generatedAt: new Date()
    };
  }
}

// 导出单例
module.exports = new ContentAnalyzer();
