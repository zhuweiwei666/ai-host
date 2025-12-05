/**
 * 尺度自适应控制器 - AI自进化系统 Phase 3
 * 根据用户实时反馈动态调整内容尺度和对话节奏
 */
const UserProfile = require('../models/UserProfile');
const UserEvent = require('../models/UserEvent');

class PaceController {
  
  // ==================== 实时调整 ====================
  
  /**
   * 根据用户最近行为调整阈值
   * @returns {Object} { intimacyMultiplier, contentLevelOffset, adjustmentReason }
   */
  async getPersonalizedThresholds(userId, agentId) {
    const profile = await UserProfile.findOne({ userId, agentId }).lean();
    
    // 默认值
    const defaults = {
      intimacyMultiplier: 1,
      contentLevelOffset: 0,
      adjustmentReason: 'default',
    };
    
    if (!profile) return defaults;
    
    // 如果已有个性化阈值且最近更新过，直接返回
    const thresholds = profile.aiAnalysis?.personalizedThresholds;
    if (thresholds?.lastAdjusted) {
      const hoursSinceAdjust = (Date.now() - new Date(thresholds.lastAdjusted).getTime()) / (1000 * 60 * 60);
      if (hoursSinceAdjust < 1) {
        return {
          intimacyMultiplier: thresholds.intimacyMultiplier || 1,
          contentLevelOffset: thresholds.contentLevelOffset || 0,
          adjustmentReason: 'cached',
        };
      }
    }
    
    // 重新计算
    return this.calculateAndUpdateThresholds(userId, agentId);
  }
  
  /**
   * 计算并更新个性化阈值
   */
  async calculateAndUpdateThresholds(userId, agentId) {
    // 获取最近24小时的事件
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const events = await UserEvent.find({
      userId,
      agentId,
      serverTimestamp: { $gte: since }
    }).lean();
    
    if (events.length < 5) {
      return {
        intimacyMultiplier: 1,
        contentLevelOffset: 0,
        adjustmentReason: 'insufficient_data',
      };
    }
    
    // 分析信号
    const signals = this._analyzeSignals(events);
    
    // 计算调整值
    let adjustment = 0;
    const reasons = [];
    
    // 正面信号 → 加快进度
    if (signals.highEngagement) {
      adjustment += 0.15;
      reasons.push('高互动');
    }
    if (signals.sentGift) {
      adjustment += 0.2;
      reasons.push('送礼');
    }
    if (signals.longSessions) {
      adjustment += 0.1;
      reasons.push('长会话');
    }
    if (signals.selectedBoldOptions) {
      adjustment += 0.15;
      reasons.push('选择大胆选项');
    }
    if (signals.viewedHighLevelContent) {
      adjustment += 0.1;
      reasons.push('查看高级内容');
    }
    
    // 负面信号 → 放慢进度
    if (signals.leftQuickly) {
      adjustment -= 0.2;
      reasons.push('快速离开');
    }
    if (signals.ignoredMessages) {
      adjustment -= 0.1;
      reasons.push('忽略消息');
    }
    if (signals.selectedShyOptions) {
      adjustment -= 0.15;
      reasons.push('选择含蓄选项');
    }
    if (signals.dislikedContent) {
      adjustment -= 0.15;
      reasons.push('不喜欢内容');
    }
    
    // 计算最终倍率 (0.5 - 2.0)
    const intimacyMultiplier = Math.max(0.5, Math.min(2.0, 1 + adjustment));
    
    // 内容等级偏移 (-2 到 +2)
    let contentLevelOffset = 0;
    if (signals.viewedHighLevelContent && signals.sentGift) {
      contentLevelOffset = 1;
    } else if (signals.selectedShyOptions && signals.leftQuickly) {
      contentLevelOffset = -1;
    }
    
    // 更新用户画像
    await UserProfile.updateOne(
      { userId, agentId },
      {
        $set: {
          'aiAnalysis.personalizedThresholds': {
            intimacyMultiplier,
            contentLevelOffset,
            lastAdjusted: new Date(),
          }
        }
      }
    );
    
    return {
      intimacyMultiplier,
      contentLevelOffset,
      adjustmentReason: reasons.join(', ') || 'balanced',
      signals,
    };
  }
  
  /**
   * 分析用户行为信号
   */
  _analyzeSignals(events) {
    const messageEvents = events.filter(e => e.eventType === 'message_sent');
    const giftEvents = events.filter(e => e.eventType === 'gift_sent');
    const sessionEndEvents = events.filter(e => e.eventType === 'session_end');
    const choiceEvents = events.filter(e => e.eventType === 'reply_option_selected');
    const contentEvents = events.filter(e => 
      e.eventType === 'image_viewed' || e.eventType === 'video_played'
    );
    const reactionEvents = events.filter(e => 
      e.eventType === 'content_liked' || e.eventType === 'content_disliked'
    );
    
    return {
      // 高互动: 24小时内发送超过20条消息
      highEngagement: messageEvents.length > 20,
      
      // 送礼: 24小时内有送礼
      sentGift: giftEvents.length > 0,
      
      // 长会话: 平均会话时长超过10分钟
      longSessions: sessionEndEvents.some(e => (e.context?.sessionDuration || 0) > 600),
      
      // 快速离开: 会话时长少于1分钟
      leftQuickly: sessionEndEvents.some(e => (e.context?.sessionDuration || 0) < 60),
      
      // 忽略消息: 收到回复后超过5条没有响应
      ignoredMessages: events.filter(e => 
        e.eventType === 'message_received' && !e.data?.responded
      ).length > 5,
      
      // 选择大胆选项
      selectedBoldOptions: choiceEvents.filter(e => e.data?.replyStyle === 'bold').length >= 2,
      
      // 选择含蓄选项
      selectedShyOptions: choiceEvents.filter(e => e.data?.replyStyle === 'shy').length >= 2,
      
      // 查看高级内容
      viewedHighLevelContent: contentEvents.some(e => (e.data?.contentLevel || 0) >= 3),
      
      // 不喜欢内容
      dislikedContent: reactionEvents.filter(e => e.eventType === 'content_disliked').length > 0,
    };
  }
  
  // ==================== 内容推荐调整 ====================
  
  /**
   * 获取用户适合的内容等级范围
   */
  async getContentLevelRange(userId, agentId) {
    const profile = await UserProfile.findOne({ userId, agentId }).lean();
    const intimacy = profile?.intimacy || 0;
    const userType = profile?.userType || 'unknown';
    const offset = profile?.aiAnalysis?.personalizedThresholds?.contentLevelOffset || 0;
    
    // 基础等级范围（基于亲密度）
    let minLevel = 1;
    let maxLevel = 1;
    
    if (intimacy >= 80) {
      minLevel = 3;
      maxLevel = 5;
    } else if (intimacy >= 50) {
      minLevel = 2;
      maxLevel = 4;
    } else if (intimacy >= 20) {
      minLevel = 1;
      maxLevel = 3;
    }
    
    // 根据用户类型调整
    if (userType === 'direct') {
      maxLevel = Math.min(5, maxLevel + 1);
    } else if (userType === 'slow_burn') {
      maxLevel = Math.max(1, maxLevel - 1);
    }
    
    // 应用个性化偏移
    minLevel = Math.max(1, Math.min(5, minLevel + offset));
    maxLevel = Math.max(1, Math.min(5, maxLevel + offset));
    
    return { minLevel, maxLevel, offset };
  }
  
  // ==================== 对话节奏控制 ====================
  
  /**
   * 判断是否应该发送图片
   */
  async shouldSendImage(userId, agentId, context = {}) {
    const profile = await UserProfile.findOne({ userId, agentId }).lean();
    
    // 基础条件
    const intimacy = profile?.intimacy || 0;
    const ltvTier = profile?.aiAnalysis?.spending?.ltvTier || 'free';
    const messageCount = context.messageCount || 0;
    
    // 高付费用户更容易触发图片
    if (ltvTier === 'whale' || ltvTier === 'dolphin') {
      return {
        should: messageCount % 5 === 0, // 每5条消息
        reason: 'paid_user_bonus',
      };
    }
    
    // 高亲密度用户
    if (intimacy >= 50) {
      return {
        should: messageCount % 8 === 0, // 每8条消息
        reason: 'high_intimacy',
      };
    }
    
    // 普通用户
    return {
      should: messageCount % 15 === 0 && messageCount > 0, // 每15条消息
      reason: 'default',
    };
  }
  
  /**
   * 获取推荐的回复长度
   */
  getRecommendedResponseLength(context = {}) {
    const { intimacy = 0, userType = 'unknown', lastUserMessageLength = 0 } = context;
    
    // 基础长度
    let minLength = 20;
    let maxLength = 100;
    
    // 用户消息长的话，可以回复长一点
    if (lastUserMessageLength > 100) {
      maxLength = 200;
    }
    
    // 高亲密度可以更详细
    if (intimacy >= 60) {
      maxLength = 250;
    }
    
    // 直接型用户喜欢简洁
    if (userType === 'direct') {
      maxLength = Math.min(maxLength, 80);
    }
    
    return { minLength, maxLength };
  }
  
  // ==================== 批量更新 ====================
  
  /**
   * 批量更新所有活跃用户的阈值
   */
  async updateAllThresholds() {
    console.log('[PaceController] 批量更新个性化阈值...');
    
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // 找到最近活跃的用户
    const activeUsers = await UserEvent.aggregate([
      { $match: { serverTimestamp: { $gte: since } } },
      { $group: { _id: { userId: '$userId', agentId: '$agentId' } } },
      { $limit: 500 }
    ]);
    
    let updated = 0;
    for (const user of activeUsers) {
      try {
        await this.calculateAndUpdateThresholds(user._id.userId, user._id.agentId);
        updated++;
      } catch (err) {
        // 忽略单个用户的错误
      }
    }
    
    console.log(`[PaceController] 更新了 ${updated} 个用户的阈值`);
    return updated;
  }
}

// 导出单例
module.exports = new PaceController();
