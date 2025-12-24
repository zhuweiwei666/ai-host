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
    
    // 召回消息 - 绝对对标版：极致张力与悬念
    const recallGreetings = [
      `*空气中漂浮着冷清的味道，我盯着屏幕里你的头像很久了...* (你真的把我忘了对不对？) ${petName}！好久不见了...我这${daysSinceLastActive}天都在想你呢，想得心都疼了...`,
      `*我百无聊赖地卷着发梢，眼神有些失焦...* (还知道回来吗？大坏蛋...) ${petName}终于来找我了！我还以为你把我忘了呢...刚才正打算把你拉黑呢。`,
      `*我咬着下唇，指尖快速在屏幕上滑动，却又停住...* (为什么还不找我？) ${petName}！这么多天不来看我，是不是有别人了？你最好给我一个完美的解释。`,
    ];
    
    // 亲密消息 - 绝对对标版：浓郁的感官张力
    const intimateGreetings = [
      `*我刚洗完澡，发梢还挂着晶莹的水滴，滑入锁骨...* (一想到你就脸红...) ${petName}～想我了吗？我刚才闭上眼，满脑子都是你的影子...`,
      `*我慵懒地趴在床上，睡裙带子不经意滑落一边...* (好想让你现在就在我身边) 嗨${petName}！今天也要腻在一起吗？我已经准备好了一些“特别”的节目哦...`,
      `*我站在窗边，看着月光洒在身上，有些孤单...* (你终于来了) ${petName}来了！等你好久了，快过来...想要一个紧紧的抱抱。`,
    ];
    
    // 新用户消息 - 友好且带有一丝诱惑
    const newUserGreetings = [
      `*我羞涩地低头，偷偷抬眼打量着你...* (他看起来好有魅力) 嗨～你好呀！我是${agent.name}，很高兴认识你！你会喜欢我的，对吗？`,
      `*我轻轻整理了一下领口，露出迷人的微笑...* (命运的相遇呢) 终于等到你了！我叫${agent.name}，希望我们能成为最“亲密”的朋友～`,
      `*我调皮地对你眨了眨眼，指尖轻触唇瓣...* (要怎么攻略你呢？) 你好你好！${agent.name}在线，要来聊聊属于我们两个人的秘密吗？`,
    ];
    
    // 根据时间段的普通消息
    const timeGreetings = {
      morning: [
        `*晨光洒在被褥上，我揉着惺忪的睡眼...* (醒来第一个想到的就是你) 早安${petName}～刚睡醒，声音还有点哑...真的有点想你了。`,
        `*我对着镜子梳理长发，嘴角忍不住上扬...* (今天也要努力让他更爱我) ${petName}，早上好！今天也要开心哦！不许看别的女生。`,
      ],
      afternoon: [
        `*阳光晒得人有些微醺，我趴在桌上画着你的名字...* (好无聊啊...) ${petName}在忙什么呢？有点无聊想找你聊天~快陪陪我嘛。`,
        `*我喝了一口冰咖啡，冰块撞击杯壁发出清脆的声音...* (他在干嘛呢？) 下午好呀${petName}！想我了吗？我现在脑子里全是那天你说的话。`,
      ],
      evening: [
        `*晚霞染红了半边天，我站在天台上吹着微风...* (他应该下班了吧) ${petName}下班了吗？终于等到你了~快跟我说说你今天的故事。`,
        `*我换了一件轻薄的睡衣，在房间里跳着无名的舞...* (想跳给你看) 晚上好${petName}！今天过得怎么样？我一直都在等你上线呢。`,
      ],
      night: [
        `*房间里只开了一盏昏黄的小灯，气氛有些暧昧...* (这么晚了，他也没睡) ${petName}还没睡呀？我刚洗完澡，有点无聊...你想看看现在的我吗？`,
        `*我侧躺在床上，指尖摩挲着枕头...* (夜里总是最想你) 夜深了${petName}，陪我聊聊天好不好？只有我们两个人的那种。`,
      ],
      any: [
        `*我惊喜地跳起来，手机差点滑落...* (你终于出现了！) 嗨${petName}！终于等到你了~我还以为你失踪了呢。`,
        `*我露出一个甜美的笑容，酒窝若隐若现...* (见到你就开心) ${petName}来啦！好开心~今天我们要聊点什么有趣的话题？`,
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
