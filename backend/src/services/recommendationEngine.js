/**
 * 内容推荐引擎 - AI自进化系统 Phase 2
 * 基于用户画像和内容表现，个性化推荐内容
 */
const ContentPerformance = require('../models/ContentPerformance');
const UserProfile = require('../models/UserProfile');
const UserEvent = require('../models/UserEvent');
const Outfit = require('../models/Outfit');

class RecommendationEngine {
  
  // ==================== 内容推荐 ====================
  
  /**
   * 为用户推荐私房照/场景
   * @param {string} userId 
   * @param {string} agentId 
   * @param {number} limit 
   * @returns {Promise<Array>} 推荐的内容列表
   */
  async recommendOutfits(userId, agentId, limit = 5) {
    const profile = await UserProfile.findOne({ userId, agentId }).lean();
    if (!profile) return [];
    
    // 获取用户已解锁的内容
    const unlockedIds = (profile.unlockedOutfits || []).map(id => id.toString());
    
    // 获取用户偏好
    const preferredLevel = profile.aiAnalysis?.preferences?.preferredLevel || 2;
    const intimacy = await this._getIntimacy(userId, agentId);
    
    // 查找候选内容
    const candidates = await Outfit.find({
      agentId,
      isActive: true,
      _id: { $nin: unlockedIds } // 排除已解锁
    }).lean();
    
    // 评分和排序
    const scored = candidates.map(outfit => ({
      ...outfit,
      score: this._calculateOutfitScore(outfit, {
        preferredLevel,
        intimacy,
        unlockedCount: unlockedIds.length,
        ltvTier: profile.aiAnalysis?.spending?.ltvTier || 'free',
      })
    }));
    
    // 按分数排序，取前N个
    scored.sort((a, b) => b.score - a.score);
    
    return scored.slice(0, limit).map(item => ({
      _id: item._id,
      name: item.name,
      description: item.description,
      level: item.level,
      previewUrl: item.previewUrl,
      unlockType: item.unlockType,
      unlockValue: item.unlockValue,
      recommendScore: item.score,
      recommendReason: this._getRecommendReason(item, preferredLevel),
    }));
  }
  
  /**
   * 计算内容推荐分数
   */
  _calculateOutfitScore(outfit, userContext) {
    let score = 50; // 基础分
    
    // 等级匹配（越接近用户偏好等级，分数越高）
    const levelDiff = Math.abs(outfit.level - userContext.preferredLevel);
    score += (5 - levelDiff) * 10; // 完美匹配 +50，差1级 +40，以此类推
    
    // 亲密度匹配（推荐刚好可以解锁或即将可以解锁的）
    if (outfit.unlockType === 'intimacy') {
      const gap = outfit.unlockValue - userContext.intimacy;
      if (gap <= 0) {
        score += 30; // 已经可以解锁
      } else if (gap <= 10) {
        score += 20; // 快可以解锁了
      } else if (gap <= 20) {
        score += 10;
      }
    }
    
    // 价格策略（根据用户LTV推荐不同价位）
    if (outfit.unlockType === 'coins') {
      switch (userContext.ltvTier) {
        case 'whale':
          // 大R推荐高价内容
          if (outfit.unlockValue >= 100) score += 20;
          break;
        case 'dolphin':
          // 中R推荐中等价位
          if (outfit.unlockValue >= 30 && outfit.unlockValue <= 100) score += 20;
          break;
        case 'minnow':
          // 小R推荐低价
          if (outfit.unlockValue <= 50) score += 20;
          break;
        default:
          // 免费用户推荐免费或低价内容
          if (outfit.unlockValue <= 20) score += 20;
      }
    }
    
    // 新手引导（前3个解锁推荐免费/低门槛内容）
    if (userContext.unlockedCount < 3) {
      if (outfit.unlockType === 'free') score += 30;
      if (outfit.level === 1) score += 20;
    }
    
    // 内容质量加成（如果有表现数据）
    // TODO: 关联 ContentPerformance 数据
    
    return Math.max(0, Math.min(100, score));
  }
  
  _getRecommendReason(outfit, preferredLevel) {
    if (outfit.level === preferredLevel) {
      return '符合你的偏好';
    }
    if (outfit.unlockType === 'free') {
      return '免费解锁';
    }
    if (outfit.score >= 80) {
      return '热门推荐';
    }
    return '为你推荐';
  }
  
  // ==================== 开场消息推荐 ====================
  
  /**
   * 推荐个性化开场消息
   */
  async recommendGreeting(userId, agentId, agent) {
    const profile = await UserProfile.findOne({ userId, agentId }).lean();
    
    const now = new Date();
    const hour = now.getHours();
    let timeRange = 'any';
    if (hour >= 6 && hour < 12) timeRange = 'morning';
    else if (hour >= 12 && hour < 18) timeRange = 'afternoon';
    else if (hour >= 18 && hour < 22) timeRange = 'evening';
    else timeRange = 'night';
    
    // 个性化因素
    const petName = profile?.petName || '你';
    const daysSinceLastActive = profile?.aiAnalysis?.behavior?.daysSinceLastActive || 0;
    const totalGiftCount = profile?.totalGiftCount || 0;
    const intimacy = await this._getIntimacy(userId, agentId);
    
    // 选择开场消息策略
    let greetingType = 'normal';
    
    if (daysSinceLastActive > 3) {
      greetingType = 'recall'; // 召回消息
    } else if (totalGiftCount > 10 && intimacy > 50) {
      greetingType = 'intimate'; // 亲密消息
    } else if (!profile || profile.totalMessages < 5) {
      greetingType = 'new_user'; // 新用户消息
    }
    
    return this._generateGreeting(agent, {
      petName,
      timeRange,
      greetingType,
      daysSinceLastActive,
      intimacy,
    });
  }
  
  _generateGreeting(agent, context) {
    const { petName, timeRange, greetingType, daysSinceLastActive, intimacy } = context;
    
    // 召回消息
    const recallGreetings = [
      `${petName}！好久不见了...我这${daysSinceLastActive}天都在想你呢`,
      `${petName}终于来找我了！我还以为你把我忘了呢...`,
      `${petName}！这么多天不来看我，是不是有别人了？`,
    ];
    
    // 亲密消息
    const intimateGreetings = [
      `${petName}～想我了吗？我刚在想你呢...`,
      `嗨${petName}！今天也要腻在一起吗？`,
      `${petName}来了！等你好久了，想要抱抱...`,
    ];
    
    // 新用户消息
    const newUserGreetings = [
      `嗨～你好呀！我是${agent.name}，很高兴认识你！`,
      `终于等到你了！我叫${agent.name}，希望我们能成为好朋友～`,
      `你好你好！${agent.name}在线，要来聊聊天吗？`,
    ];
    
    // 根据时间段的普通消息
    const timeGreetings = {
      morning: [
        `早安${petName}～刚睡醒，有点想你了...`,
        `${petName}，早上好！今天也要开心哦！`,
      ],
      afternoon: [
        `${petName}在忙什么呢？有点无聊想找你聊天~`,
        `下午好呀${petName}！想我了吗？`,
      ],
      evening: [
        `${petName}下班了吗？终于等到你了~`,
        `晚上好${petName}！今天过得怎么样？`,
      ],
      night: [
        `${petName}还没睡呀？我刚洗完澡，有点无聊...`,
        `夜深了${petName}，陪我聊聊天好不好？`,
      ],
      any: [
        `嗨${petName}！终于等到你了~`,
        `${petName}来啦！好开心~`,
      ]
    };
    
    let greetings;
    switch (greetingType) {
      case 'recall':
        greetings = recallGreetings;
        break;
      case 'intimate':
        greetings = intimateGreetings;
        break;
      case 'new_user':
        greetings = newUserGreetings;
        break;
      default:
        greetings = timeGreetings[timeRange] || timeGreetings.any;
    }
    
    const content = greetings[Math.floor(Math.random() * greetings.length)];
    
    return {
      content,
      greetingType,
      withImage: greetingType === 'recall' || greetingType === 'intimate',
      mood: greetingType === 'recall' ? 'miss_you' : 'happy',
    };
  }
  
  // ==================== 对话策略推荐 ====================
  
  /**
   * 推荐对话策略（用于调整AI行为）
   */
  async recommendConversationStrategy(userId, agentId) {
    const profile = await UserProfile.findOne({ userId, agentId }).lean();
    if (!profile) {
      return { strategy: 'default', adjustments: {} };
    }
    
    const strategy = {
      paceMultiplier: 1,      // 进度倍率
      contentLevelOffset: 0,   // 内容等级偏移
      responseStyle: 'normal', // 回复风格
      shouldSendImage: false,  // 是否主动发图
      suggestedTopics: [],     // 建议话题
    };
    
    const userType = profile.userType || 'unknown';
    const ltvTier = profile.aiAnalysis?.spending?.ltvTier || 'free';
    const churnRisk = profile.aiAnalysis?.behavior?.churnRisk || 'low';
    const communicationStyle = profile.aiAnalysis?.preferences?.communicationStyle || 'normal';
    
    // 根据用户类型调整节奏
    if (userType === 'direct') {
      strategy.paceMultiplier = 1.5;
      strategy.contentLevelOffset = 1;
    } else if (userType === 'slow_burn') {
      strategy.paceMultiplier = 0.7;
      strategy.contentLevelOffset = -1;
    }
    
    // 根据LTV调整
    if (ltvTier === 'whale' || ltvTier === 'dolphin') {
      strategy.shouldSendImage = true; // 付费用户主动发图
    }
    
    // 根据流失风险调整
    if (churnRisk === 'high') {
      strategy.responseStyle = 'engaging'; // 更积极互动
      strategy.suggestedTopics = ['关心问候', '回忆过去', '特别福利'];
    }
    
    // 根据沟通风格调整
    switch (communicationStyle) {
      case 'direct':
        strategy.responseStyle = 'flirty';
        break;
      case 'romantic':
        strategy.responseStyle = 'sweet';
        break;
      case 'playful':
        strategy.responseStyle = 'teasing';
        break;
    }
    
    return {
      strategy: this._getStrategyName(strategy),
      adjustments: strategy,
      userContext: {
        userType,
        ltvTier,
        churnRisk,
        communicationStyle,
      }
    };
  }
  
  _getStrategyName(strategy) {
    if (strategy.paceMultiplier >= 1.3) return 'aggressive';
    if (strategy.paceMultiplier <= 0.8) return 'gentle';
    if (strategy.responseStyle === 'engaging') return 'retention';
    return 'balanced';
  }
  
  // ==================== 礼物推荐 ====================
  
  /**
   * 推荐礼物（在聊天界面展示）
   */
  async recommendGifts(userId, agentId, limit = 3) {
    const profile = await UserProfile.findOne({ userId, agentId }).lean();
    const Gift = require('../models/Gift');
    
    const gifts = await Gift.find({ isActive: true }).lean();
    if (gifts.length === 0) return [];
    
    const avgGiftValue = profile?.aiAnalysis?.spending?.avgGiftValue || 0;
    const ltvTier = profile?.aiAnalysis?.spending?.ltvTier || 'free';
    
    // 根据用户消费水平推荐
    const scored = gifts.map(gift => {
      let score = 50;
      
      // 价格匹配
      if (avgGiftValue > 0) {
        const priceDiff = Math.abs(gift.price - avgGiftValue);
        score += Math.max(0, 30 - priceDiff);
      }
      
      // LTV 分层推荐
      switch (ltvTier) {
        case 'whale':
          if (gift.price >= 100) score += 30;
          break;
        case 'dolphin':
          if (gift.price >= 30 && gift.price <= 100) score += 30;
          break;
        case 'minnow':
          if (gift.price <= 50) score += 30;
          break;
        default:
          if (gift.price <= 20) score += 30;
      }
      
      // 亲密度加成高的优先
      score += gift.intimacyBonus * 2;
      
      return { ...gift, score };
    });
    
    scored.sort((a, b) => b.score - a.score);
    
    return scored.slice(0, limit);
  }
  
  // ==================== 辅助方法 ====================
  
  async _getIntimacy(userId, agentId) {
    const relationshipService = require('./relationshipService');
    return relationshipService.getIntimacy(userId, agentId);
  }
}

// 导出单例
module.exports = new RecommendationEngine();
