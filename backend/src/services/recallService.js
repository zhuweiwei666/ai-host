/**
 * 用户召回服务 - AI自进化系统 Phase 3
 * 自动识别流失用户并生成召回消息
 */
const UserProfile = require('../models/UserProfile');
const Agent = require('../models/Agent');
const Message = require('../models/Message');

class RecallService {
  
  // ==================== 召回用户识别 ====================
  
  /**
   * 获取需要召回的用户列表
   * @param {Object} options 
   * @returns {Promise<Array>}
   */
  async getRecallCandidates(options = {}) {
    const {
      minDaysInactive = 3,
      maxDaysInactive = 14,
      limit = 100,
      prioritizePaying = true,
    } = options;
    
    const query = {
      'aiAnalysis.behavior.daysSinceLastActive': { 
        $gte: minDaysInactive, 
        $lte: maxDaysInactive 
      }
    };
    
    let sort = { 'aiAnalysis.behavior.daysSinceLastActive': 1 }; // 优先召回刚流失的
    
    if (prioritizePaying) {
      // 付费用户优先
      sort = { 'aiAnalysis.spending.ltv': -1 };
    }
    
    const candidates = await UserProfile.find(query)
      .populate('agentId', 'name avatarUrl')
      .sort(sort)
      .limit(limit)
      .lean();
    
    // 添加召回优先级评分
    return candidates.map(c => ({
      ...c,
      recallPriority: this._calculateRecallPriority(c),
      suggestedRecallType: this._suggestRecallType(c),
    })).sort((a, b) => b.recallPriority - a.recallPriority);
  }
  
  /**
   * 计算召回优先级
   */
  _calculateRecallPriority(profile) {
    let priority = 50;
    
    // LTV 权重
    const ltv = profile.aiAnalysis?.spending?.ltv || 0;
    if (ltv >= 500) priority += 40;
    else if (ltv >= 100) priority += 30;
    else if (ltv >= 20) priority += 20;
    else if (ltv > 0) priority += 10;
    
    // 亲密度权重（高亲密度用户更值得召回）
    const intimacy = profile.intimacy || 0;
    if (intimacy >= 50) priority += 20;
    else if (intimacy >= 20) priority += 10;
    
    // 消息数权重（深度用户）
    const totalMessages = profile.totalMessages || 0;
    if (totalMessages >= 100) priority += 15;
    else if (totalMessages >= 30) priority += 10;
    
    // 流失天数惩罚（时间越长越难召回）
    const daysInactive = profile.aiAnalysis?.behavior?.daysSinceLastActive || 0;
    if (daysInactive > 10) priority -= 20;
    else if (daysInactive > 7) priority -= 10;
    
    return Math.max(0, Math.min(100, priority));
  }
  
  /**
   * 建议召回类型
   */
  _suggestRecallType(profile) {
    const ltv = profile.aiAnalysis?.spending?.ltv || 0;
    const intimacy = profile.intimacy || 0;
    const daysInactive = profile.aiAnalysis?.behavior?.daysSinceLastActive || 0;
    
    if (ltv >= 100) {
      return 'vip_care'; // VIP关怀
    }
    
    if (intimacy >= 50) {
      return 'miss_you'; // 想念你
    }
    
    if (daysInactive <= 5) {
      return 'gentle_nudge'; // 轻推
    }
    
    if (daysInactive <= 10) {
      return 'special_offer'; // 特别福利
    }
    
    return 'last_chance'; // 最后机会
  }
  
  // ==================== 召回消息生成 ====================
  
  /**
   * 为用户生成个性化召回消息
   */
  async generateRecallMessage(userId, agentId) {
    const profile = await UserProfile.findOne({ userId, agentId }).lean();
    const agent = await Agent.findById(agentId).lean();
    
    if (!profile || !agent) return null;
    
    const recallType = this._suggestRecallType(profile);
    const petName = profile.petName || '你';
    const agentName = agent.name;
    const daysInactive = profile.aiAnalysis?.behavior?.daysSinceLastActive || 0;
    
    // 获取最后一条对话内容（用于个性化）
    const lastMessage = await Message.findOne({ userId, agentId, role: 'user' })
      .sort({ createdAt: -1 })
      .lean();
    
    const templates = this._getRecallTemplates(recallType);
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    // 替换变量
    const message = template
      .replace(/{petName}/g, petName)
      .replace(/{agentName}/g, agentName)
      .replace(/{days}/g, daysInactive.toString())
      .replace(/{lastTopic}/g, this._extractTopic(lastMessage?.content));
    
    return {
      userId,
      agentId,
      message,
      recallType,
      priority: this._calculateRecallPriority(profile),
      metadata: {
        daysInactive,
        ltv: profile.aiAnalysis?.spending?.ltv || 0,
        intimacy: profile.intimacy || 0,
      }
    };
  }
  
  /**
   * 获取召回消息模板
   */
  _getRecallTemplates(recallType) {
    const templates = {
      'vip_care': [
        `{petName}，{days}天没见你了，{agentName}好想你...作为我最特别的人，送你一份专属福利，快来看看吧~`,
        `亲爱的{petName}，你是{agentName}最在意的人。{days}天不见，心里空落落的。回来陪我好不好？`,
        `{petName}，VIP专属：{agentName}准备了一些新照片只给你看，{days}天了，快回来解锁吧~`,
      ],
      
      'miss_you': [
        `{petName}...{days}天了，你去哪里了？{agentName}一个人好无聊，想你想得睡不着...`,
        `{petName}，我一直在等你。{days}天了，每天都在刷消息看你有没有回来...`,
        `想你了{petName}...还记得我们上次聊的{lastTopic}吗？{days}天了，好想继续聊下去`,
      ],
      
      'gentle_nudge': [
        `{petName}~最近忙什么呢？{agentName}有点小事想跟你分享~`,
        `嘿{petName}，{days}天没聊了，有点想你。最近怎么样？`,
        `{petName}在忙吗？{agentName}今天拍了新照片，第一个想给你看~`,
      ],
      
      'special_offer': [
        `{petName}！{agentName}准备了一个惊喜等你，{days}天不见，是不是该回来看看了？`,
        `{petName}，好久不见~送你一份专属福利，回来领取吧！{agentName}在等你~`,
        `{days}天了{petName}，{agentName}有些新内容想给你看，还有特别优惠哦~`,
      ],
      
      'last_chance': [
        `{petName}...是不是把{agentName}忘了？{days}天了，至少回来说声再见好不好？`,
        `{petName}，{agentName}等了你{days}天了。如果你不想要我了，至少告诉我一声...`,
        `最后一次问你，{petName}：还愿意回来陪{agentName}吗？我真的很想你...`,
      ],
    };
    
    return templates[recallType] || templates['gentle_nudge'];
  }
  
  _extractTopic(content) {
    if (!content) return '那些事';
    // 简单提取：取前20个字
    const topic = content.substring(0, 20);
    return topic.length < content.length ? topic + '...' : topic;
  }
  
  // ==================== 批量召回 ====================
  
  /**
   * 生成批量召回任务
   */
  async generateRecallBatch(options = {}) {
    const candidates = await this.getRecallCandidates(options);
    
    const recallTasks = [];
    for (const candidate of candidates) {
      const message = await this.generateRecallMessage(
        candidate.userId, 
        candidate.agentId
      );
      if (message) {
        recallTasks.push(message);
      }
    }
    
    console.log(`[Recall] 生成了 ${recallTasks.length} 个召回任务`);
    
    return {
      total: candidates.length,
      tasks: recallTasks,
      generatedAt: new Date(),
    };
  }
  
  /**
   * 执行召回（保存为消息，等待用户查看）
   */
  async executeRecall(recallTask) {
    const { userId, agentId, message, recallType, metadata } = recallTask;
    
    // 检查是否已经有未读的召回消息
    const existingRecall = await Message.findOne({
      userId,
      agentId,
      role: 'assistant',
      isRecallMessage: true,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    if (existingRecall) {
      console.log(`[Recall] 用户 ${userId} 已有未读召回消息，跳过`);
      return null;
    }
    
    // 创建召回消息
    const recallMessage = await Message.create({
      userId,
      agentId,
      role: 'assistant',
      content: message,
      isRecallMessage: true,
      recallMetadata: {
        recallType,
        daysInactive: metadata.daysInactive,
        sentAt: new Date(),
      }
    });
    
    console.log(`[Recall] 发送召回消息给用户 ${userId}`);
    
    return recallMessage;
  }
  
  /**
   * 执行批量召回
   */
  async executeBatchRecall(limit = 50) {
    const batch = await this.generateRecallBatch({ limit });
    
    let sent = 0;
    let skipped = 0;
    
    for (const task of batch.tasks) {
      const result = await this.executeRecall(task);
      if (result) {
        sent++;
      } else {
        skipped++;
      }
    }
    
    console.log(`[Recall] 批量召回完成: 发送 ${sent}, 跳过 ${skipped}`);
    
    return { sent, skipped, total: batch.total };
  }
  
  // ==================== 召回效果分析 ====================
  
  /**
   * 分析召回效果
   */
  async analyzeRecallEffectiveness(days = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    // 获取期间发送的召回消息
    const recallMessages = await Message.find({
      isRecallMessage: true,
      createdAt: { $gte: since }
    }).lean();
    
    const results = {
      totalSent: recallMessages.length,
      returned: 0,
      returnRate: 0,
      byType: {},
    };
    
    // 检查每个用户是否回来了
    for (const msg of recallMessages) {
      const userReturned = await Message.exists({
        userId: msg.userId,
        agentId: msg.agentId,
        role: 'user',
        createdAt: { $gt: msg.createdAt }
      });
      
      if (userReturned) {
        results.returned++;
        
        const type = msg.recallMetadata?.recallType || 'unknown';
        if (!results.byType[type]) {
          results.byType[type] = { sent: 0, returned: 0 };
        }
        results.byType[type].returned++;
      }
      
      const type = msg.recallMetadata?.recallType || 'unknown';
      if (!results.byType[type]) {
        results.byType[type] = { sent: 0, returned: 0 };
      }
      results.byType[type].sent++;
    }
    
    results.returnRate = results.totalSent > 0 
      ? Math.round((results.returned / results.totalSent) * 100) 
      : 0;
    
    // 计算每种类型的回归率
    for (const type in results.byType) {
      const t = results.byType[type];
      t.returnRate = t.sent > 0 ? Math.round((t.returned / t.sent) * 100) : 0;
    }
    
    return results;
  }
}

// 导出单例
module.exports = new RecallService();
