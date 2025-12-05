/**
 * 用户分析服务 - AI自进化系统 Phase 2
 * 自动分析用户行为、更新画像、预测流失
 */
const UserProfile = require('../models/UserProfile');
const UserEvent = require('../models/UserEvent');
const Message = require('../models/Message');
const Agent = require('../models/Agent');

class UserAnalyzer {
  
  // ==================== 用户画像自动更新 ====================
  
  /**
   * 分析并更新单个用户的画像
   */
  async analyzeUser(userId, agentId) {
    const profile = await UserProfile.findOne({ userId, agentId });
    if (!profile) return null;
    
    // 获取用户最近30天的事件数据
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const events = await UserEvent.find({
      userId,
      agentId,
      serverTimestamp: { $gte: since }
    }).lean();
    
    if (events.length < 5) {
      // 数据太少，跳过分析
      return null;
    }
    
    // 分析各维度
    const preferences = this._analyzePreferences(events);
    const spending = await this._analyzeSpending(userId, agentId, events);
    const behavior = this._analyzeBehavior(events);
    const contentConsumption = this._analyzeContentConsumption(events);
    const conversationQuality = await this._analyzeConversationQuality(userId, agentId);
    const churnRisk = this._calculateChurnRisk(behavior, events);
    
    // 更新画像
    const update = {
      'aiAnalysis.preferences': preferences,
      'aiAnalysis.spending': { ...profile.aiAnalysis?.spending, ...spending },
      'aiAnalysis.behavior': { ...behavior, churnRisk, churnRiskUpdatedAt: new Date() },
      'aiAnalysis.contentConsumption': contentConsumption,
      'aiAnalysis.conversationQuality': conversationQuality,
      'aiAnalysis.lastAnalyzedAt': new Date(),
      'aiAnalysis.dataPoints': events.length,
    };
    
    await UserProfile.updateOne({ userId, agentId }, { $set: update });
    
    return { userId, agentId, ...update };
  }
  
  /**
   * 分析用户偏好
   */
  _analyzePreferences(events) {
    const preferences = {
      contentStyle: [],
      communicationStyle: 'unknown',
      preferredLevel: 1,
      activeTimeSlots: [],
      favoriteTopics: [],
    };
    
    // 分析活跃时段
    const timeSlotCounts = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    events.forEach(e => {
      if (e.context?.timeOfDay) {
        timeSlotCounts[e.context.timeOfDay]++;
      }
    });
    
    preferences.activeTimeSlots = Object.entries(timeSlotCounts)
      .filter(([_, count]) => count > events.length * 0.2)
      .map(([slot, _]) => slot);
    
    // 分析内容偏好等级
    const levelViews = {};
    events
      .filter(e => e.eventType === 'image_viewed' || e.eventType === 'video_played')
      .forEach(e => {
        const level = e.data?.contentLevel || 1;
        levelViews[level] = (levelViews[level] || 0) + 1;
      });
    
    if (Object.keys(levelViews).length > 0) {
      preferences.preferredLevel = parseInt(
        Object.entries(levelViews)
          .sort((a, b) => b[1] - a[1])[0][0]
      );
    }
    
    // 分析沟通风格（基于选项选择）
    const choiceEvents = events.filter(e => e.eventType === 'reply_option_selected');
    if (choiceEvents.length >= 3) {
      const styleCount = { shy: 0, normal: 0, bold: 0 };
      choiceEvents.forEach(e => {
        const style = e.data?.replyStyle;
        if (style && styleCount[style] !== undefined) {
          styleCount[style]++;
        }
      });
      
      const dominant = Object.entries(styleCount).sort((a, b) => b[1] - a[1])[0];
      if (dominant[1] > choiceEvents.length * 0.4) {
        preferences.communicationStyle = dominant[0] === 'bold' ? 'direct' 
          : dominant[0] === 'shy' ? 'romantic' : 'playful';
      }
    }
    
    return preferences;
  }
  
  /**
   * 分析消费行为
   */
  async _analyzeSpending(userId, agentId, events) {
    const giftEvents = events.filter(e => e.eventType === 'gift_sent');
    const purchaseEvents = events.filter(e => e.eventType === 'coins_purchased');
    
    const spending = {
      avgGiftValue: 0,
      purchaseFrequency: 'never',
    };
    
    // 平均礼物价值
    if (giftEvents.length > 0) {
      const totalGiftValue = giftEvents.reduce((sum, e) => sum + (e.data?.amount || 0), 0);
      spending.avgGiftValue = Math.round(totalGiftValue / giftEvents.length);
    }
    
    // 充值频率
    if (purchaseEvents.length >= 5) {
      spending.purchaseFrequency = 'frequent';
    } else if (purchaseEvents.length >= 2) {
      spending.purchaseFrequency = 'occasional';
    } else if (purchaseEvents.length >= 1) {
      spending.purchaseFrequency = 'rare';
    }
    
    // 价格敏感度（基于礼物选择分布）
    if (giftEvents.length >= 5) {
      const avgValue = spending.avgGiftValue;
      if (avgValue >= 100) {
        spending.priceSensitivity = 'low'; // 大手笔
      } else if (avgValue >= 30) {
        spending.priceSensitivity = 'medium';
      } else {
        spending.priceSensitivity = 'high'; // 价格敏感
      }
    }
    
    return spending;
  }
  
  /**
   * 分析行为模式
   */
  _analyzeBehavior(events) {
    const behavior = {
      avgSessionDuration: 0,
      avgMessagesPerSession: 0,
      avgDailyMessages: 0,
      returnFrequency: 'sporadic',
      engagementTrend: 'stable',
      daysSinceLastActive: 0,
    };
    
    // 会话分析
    const sessionEvents = events.filter(e => 
      e.eventType === 'session_start' || e.eventType === 'session_end'
    );
    
    const sessions = [];
    let currentSession = null;
    
    sessionEvents.sort((a, b) => new Date(a.serverTimestamp) - new Date(b.serverTimestamp));
    sessionEvents.forEach(e => {
      if (e.eventType === 'session_start') {
        currentSession = { start: new Date(e.serverTimestamp), messages: 0 };
      } else if (e.eventType === 'session_end' && currentSession) {
        currentSession.end = new Date(e.serverTimestamp);
        currentSession.duration = e.context?.sessionDuration || 
          (currentSession.end - currentSession.start) / 1000;
        currentSession.messages = e.context?.messageCount || 0;
        sessions.push(currentSession);
        currentSession = null;
      }
    });
    
    if (sessions.length > 0) {
      behavior.avgSessionDuration = Math.round(
        sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length
      );
      behavior.avgMessagesPerSession = Math.round(
        sessions.reduce((sum, s) => sum + s.messages, 0) / sessions.length
      );
    }
    
    // 日均消息数
    const messageEvents = events.filter(e => e.eventType === 'message_sent');
    const days = 30; // 分析周期
    behavior.avgDailyMessages = Math.round(messageEvents.length / days * 10) / 10;
    
    // 回访频率
    const uniqueDays = new Set(
      events
        .filter(e => e.eventType === 'session_start')
        .map(e => new Date(e.serverTimestamp).toISOString().split('T')[0])
    );
    
    if (uniqueDays.size >= 20) {
      behavior.returnFrequency = 'daily';
    } else if (uniqueDays.size >= 8) {
      behavior.returnFrequency = 'weekly';
    } else if (uniqueDays.size >= 2) {
      behavior.returnFrequency = 'monthly';
    }
    
    // 互动趋势（对比前15天 vs 后15天）
    const midPoint = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    const firstHalf = events.filter(e => new Date(e.serverTimestamp) < midPoint).length;
    const secondHalf = events.filter(e => new Date(e.serverTimestamp) >= midPoint).length;
    
    if (secondHalf > firstHalf * 1.3) {
      behavior.engagementTrend = 'increasing';
    } else if (secondHalf < firstHalf * 0.7) {
      behavior.engagementTrend = 'decreasing';
    }
    
    // 距离上次活跃
    const lastEvent = events.sort((a, b) => 
      new Date(b.serverTimestamp) - new Date(a.serverTimestamp)
    )[0];
    if (lastEvent) {
      behavior.daysSinceLastActive = Math.floor(
        (Date.now() - new Date(lastEvent.serverTimestamp)) / (24 * 60 * 60 * 1000)
      );
    }
    
    return behavior;
  }
  
  /**
   * 分析内容消费
   */
  _analyzeContentConsumption(events) {
    const consumption = {
      totalImagesViewed: 0,
      totalVideosWatched: 0,
      avgImageViewDuration: 0,
      avgVideoWatchProgress: 0,
      saveRate: 0,
      preferredContentTypes: [],
    };
    
    const imageEvents = events.filter(e => e.eventType === 'image_viewed');
    const videoEvents = events.filter(e => e.eventType === 'video_played');
    const saveEvents = events.filter(e => e.eventType === 'image_saved');
    
    consumption.totalImagesViewed = imageEvents.length;
    consumption.totalVideosWatched = videoEvents.length;
    
    // 图片平均观看时长
    const imageDurations = imageEvents
      .filter(e => e.data?.duration)
      .map(e => e.data.duration);
    if (imageDurations.length > 0) {
      consumption.avgImageViewDuration = Math.round(
        imageDurations.reduce((a, b) => a + b, 0) / imageDurations.length
      );
    }
    
    // 视频平均观看进度
    const videoProgress = videoEvents
      .filter(e => e.data?.progress)
      .map(e => e.data.progress);
    if (videoProgress.length > 0) {
      consumption.avgVideoWatchProgress = Math.round(
        videoProgress.reduce((a, b) => a + b, 0) / videoProgress.length
      );
    }
    
    // 保存率
    if (imageEvents.length > 0) {
      consumption.saveRate = Math.round((saveEvents.length / imageEvents.length) * 100);
    }
    
    // 偏好内容类型
    if (imageEvents.length > videoEvents.length * 2) {
      consumption.preferredContentTypes = ['image'];
    } else if (videoEvents.length > imageEvents.length * 2) {
      consumption.preferredContentTypes = ['video'];
    } else {
      consumption.preferredContentTypes = ['image', 'video'];
    }
    
    return consumption;
  }
  
  /**
   * 分析对话质量
   */
  async _analyzeConversationQuality(userId, agentId) {
    const messages = await Message.find({ userId, agentId, role: 'user' })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    
    if (messages.length < 10) {
      return {
        avgResponseTime: 0,
        avgMessageLength: 0,
        positiveReactionRate: 0,
        engagementScore: 50,
      };
    }
    
    // 平均消息长度
    const avgMessageLength = Math.round(
      messages.reduce((sum, m) => sum + (m.content?.length || 0), 0) / messages.length
    );
    
    // 互动评分（基于消息长度和频率）
    let engagementScore = 50;
    if (avgMessageLength > 50) engagementScore += 20;
    else if (avgMessageLength > 20) engagementScore += 10;
    
    if (messages.length > 50) engagementScore += 20;
    else if (messages.length > 20) engagementScore += 10;
    
    return {
      avgResponseTime: 0, // 需要更多数据
      avgMessageLength,
      positiveReactionRate: 0, // 需要更多数据
      engagementScore: Math.min(100, engagementScore),
    };
  }
  
  // ==================== 流失预警 ====================
  
  /**
   * 计算流失风险
   */
  _calculateChurnRisk(behavior, events) {
    let riskScore = 0;
    
    // 距离上次活跃天数
    if (behavior.daysSinceLastActive > 7) riskScore += 40;
    else if (behavior.daysSinceLastActive > 3) riskScore += 20;
    else if (behavior.daysSinceLastActive > 1) riskScore += 10;
    
    // 互动趋势下降
    if (behavior.engagementTrend === 'decreasing') riskScore += 30;
    
    // 回访频率低
    if (behavior.returnFrequency === 'sporadic') riskScore += 20;
    else if (behavior.returnFrequency === 'monthly') riskScore += 10;
    
    // 会话时长短
    if (behavior.avgSessionDuration < 60) riskScore += 10;
    
    // 日均消息少
    if (behavior.avgDailyMessages < 1) riskScore += 10;
    
    // 分类
    if (riskScore >= 60) return 'high';
    if (riskScore >= 30) return 'medium';
    return 'low';
  }
  
  /**
   * 获取高流失风险用户列表
   */
  async getHighChurnRiskUsers(limit = 100) {
    return UserProfile.find({
      'aiAnalysis.behavior.churnRisk': 'high',
      'aiAnalysis.behavior.daysSinceLastActive': { $lte: 14 } // 14天内还有救
    })
      .populate('agentId', 'name')
      .sort({ 'aiAnalysis.behavior.daysSinceLastActive': -1 })
      .limit(limit)
      .lean();
  }
  
  /**
   * 获取需要召回的用户
   */
  async getUsersForRecall(daysInactive = 3, limit = 100) {
    return UserProfile.find({
      'aiAnalysis.behavior.daysSinceLastActive': { $gte: daysInactive, $lte: 14 },
      'aiAnalysis.spending.ltvTier': { $in: ['whale', 'dolphin', 'minnow'] } // 有付费的优先
    })
      .populate('agentId', 'name')
      .sort({ 'aiAnalysis.spending.ltv': -1 })
      .limit(limit)
      .lean();
  }
  
  // ==================== 用户分层 ====================
  
  /**
   * 用户分层统计
   */
  async getUserSegmentation(agentId = null) {
    const match = agentId ? { agentId } : {};
    
    const [
      ltvDistribution,
      activityDistribution,
      churnRiskDistribution,
      userTypeDistribution
    ] = await Promise.all([
      // LTV 分布
      UserProfile.aggregate([
        { $match: match },
        { $group: { _id: '$aiAnalysis.spending.ltvTier', count: { $sum: 1 } } }
      ]),
      
      // 活跃度分布
      UserProfile.aggregate([
        { $match: match },
        { $group: { _id: '$aiAnalysis.behavior.returnFrequency', count: { $sum: 1 } } }
      ]),
      
      // 流失风险分布
      UserProfile.aggregate([
        { $match: match },
        { $group: { _id: '$aiAnalysis.behavior.churnRisk', count: { $sum: 1 } } }
      ]),
      
      // 用户类型分布
      UserProfile.aggregate([
        { $match: match },
        { $group: { _id: '$userType', count: { $sum: 1 } } }
      ])
    ]);
    
    return {
      ltv: this._toDistributionObject(ltvDistribution),
      activity: this._toDistributionObject(activityDistribution),
      churnRisk: this._toDistributionObject(churnRiskDistribution),
      userType: this._toDistributionObject(userTypeDistribution),
    };
  }
  
  _toDistributionObject(arr) {
    return arr.reduce((obj, item) => {
      obj[item._id || 'unknown'] = item.count;
      return obj;
    }, {});
  }
  
  // ==================== 批量分析 ====================
  
  /**
   * 批量更新所有用户画像
   */
  async analyzeAllUsers(limit = 1000) {
    console.log('[UserAnalyzer] 开始批量分析用户画像...');
    
    // 找到最近30天有活动的用户
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeUsers = await UserEvent.aggregate([
      { $match: { serverTimestamp: { $gte: since } } },
      { $group: { _id: { userId: '$userId', agentId: '$agentId' } } },
      { $limit: limit }
    ]);
    
    console.log(`[UserAnalyzer] 发现 ${activeUsers.length} 个活跃用户`);
    
    let analyzed = 0;
    let errors = 0;
    
    for (const user of activeUsers) {
      try {
        const result = await this.analyzeUser(user._id.userId, user._id.agentId);
        if (result) analyzed++;
      } catch (err) {
        console.error(`[UserAnalyzer] 分析用户 ${user._id.userId} 失败:`, err.message);
        errors++;
      }
    }
    
    console.log(`[UserAnalyzer] 分析完成: ${analyzed} 成功, ${errors} 失败`);
    return { analyzed, errors, total: activeUsers.length };
  }
  
  /**
   * 更新所有用户的流失风险
   */
  async updateChurnRisks() {
    console.log('[UserAnalyzer] 更新流失风险...');
    
    const profiles = await UserProfile.find({
      lastActiveAt: { $exists: true }
    });
    
    let updated = 0;
    
    for (const profile of profiles) {
      const daysSinceActive = Math.floor(
        (Date.now() - profile.lastActiveAt) / (24 * 60 * 60 * 1000)
      );
      
      const behavior = profile.aiAnalysis?.behavior || {};
      behavior.daysSinceLastActive = daysSinceActive;
      
      // 简化的流失风险计算
      let churnRisk = 'low';
      if (daysSinceActive > 7) churnRisk = 'high';
      else if (daysSinceActive > 3) churnRisk = 'medium';
      
      if (behavior.engagementTrend === 'decreasing') {
        if (churnRisk === 'low') churnRisk = 'medium';
        else if (churnRisk === 'medium') churnRisk = 'high';
      }
      
      await UserProfile.updateOne(
        { _id: profile._id },
        {
          $set: {
            'aiAnalysis.behavior.daysSinceLastActive': daysSinceActive,
            'aiAnalysis.behavior.churnRisk': churnRisk,
            'aiAnalysis.behavior.churnRiskUpdatedAt': new Date(),
          }
        }
      );
      
      updated++;
    }
    
    console.log(`[UserAnalyzer] 更新了 ${updated} 个用户的流失风险`);
    return updated;
  }
}

// 导出单例
module.exports = new UserAnalyzer();
