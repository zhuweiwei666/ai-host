/**
 * 事件收集服务 - AI自进化系统核心
 * 提供统一的事件追踪接口，自动收集上下文信息
 */
const UserEvent = require('../models/UserEvent');
const UserProfile = require('../models/UserProfile');
const ContentPerformance = require('../models/ContentPerformance');
const ConversationAnalysis = require('../models/ConversationAnalysis');
const { v4: uuidv4 } = require('uuid');

class EventCollector {
  
  // ==================== 会话管理 ====================
  
  /**
   * 开始会话
   */
  async startSession(userId, agentId, deviceInfo = {}) {
    const sessionId = uuidv4();
    
    // 更新用户档案的当前会话
    await UserProfile.findOneAndUpdate(
      { userId, agentId },
      {
        $set: {
          currentSession: {
            sessionId,
            startedAt: new Date(),
            messageCount: 0,
            lastEventAt: new Date(),
          },
          lastActiveAt: new Date(),
        }
      },
      { upsert: true }
    );
    
    // 记录会话开始事件
    await UserEvent.track(userId, agentId, 'session_start', {}, {
      sessionId,
      deviceType: deviceInfo.deviceType || 'unknown',
      platform: deviceInfo.platform || 'web',
    });
    
    // 检查是否是回流用户
    const profile = await UserProfile.findOne({ userId, agentId });
    if (profile?.aiAnalysis?.behavior?.daysSinceLastActive > 3) {
      await UserEvent.track(userId, agentId, 'returned', {
        daysSinceLastActive: profile.aiAnalysis.behavior.daysSinceLastActive,
      });
    }
    
    return sessionId;
  }
  
  /**
   * 结束会话
   */
  async endSession(userId, agentId) {
    const profile = await UserProfile.findOne({ userId, agentId });
    if (!profile?.currentSession?.sessionId) return;
    
    const sessionDuration = profile.currentSession.startedAt
      ? Math.floor((Date.now() - profile.currentSession.startedAt.getTime()) / 1000)
      : 0;
    
    await UserEvent.track(userId, agentId, 'session_end', {}, {
      sessionId: profile.currentSession.sessionId,
      sessionDuration,
      messageCount: profile.currentSession.messageCount || 0,
    });
    
    // 清除当前会话
    await UserProfile.updateOne(
      { userId, agentId },
      { $unset: { currentSession: 1 } }
    );
  }
  
  // ==================== 消息事件 ====================
  
  /**
   * 记录用户发送消息
   */
  async trackMessageSent(userId, agentId, messageData) {
    const profile = await this._getProfile(userId, agentId);
    const context = this._buildContext(profile);
    
    await UserEvent.track(userId, agentId, 'message_sent', {
      messageId: messageData.messageId,
      messageLength: messageData.content?.length || 0,
      messageType: messageData.type || 'text',
    }, context);
    
    // 更新会话消息计数
    await UserProfile.updateOne(
      { userId, agentId },
      { 
        $inc: { 'currentSession.messageCount': 1, totalMessages: 1 },
        $set: { 'currentSession.lastEventAt': new Date(), lastActiveAt: new Date() }
      }
    );
  }
  
  /**
   * 记录AI回复
   */
  async trackMessageReceived(userId, agentId, messageData) {
    const profile = await this._getProfile(userId, agentId);
    const context = this._buildContext(profile);
    
    await UserEvent.track(userId, agentId, 'message_received', {
      messageId: messageData.messageId,
      messageLength: messageData.content?.length || 0,
      messageType: messageData.type || 'text',
    }, context);
    
    // 创建对话分析记录（待评估）
    if (messageData.userMessage && messageData.aiResponse) {
      await ConversationAnalysis.create({
        messageId: messageData.messageId,
        userId,
        agentId,
        conversation: {
          userMessage: this._truncate(messageData.userMessage, 500),
          userMessageLength: messageData.userMessage.length,
          aiResponse: this._truncate(messageData.aiResponse, 500),
          aiResponseLength: messageData.aiResponse.length,
          turnNumber: profile?.totalMessages || 0,
          hasImage: messageData.hasImage || false,
        },
        context: {
          intimacy: profile?.intimacy || 0,
          userType: profile?.userType || 'unknown',
          stage: messageData.stage || 1,
          detectionRound: profile?.detectionRound || 0,
        },
        evaluationStatus: 'pending',
      });
    }
  }
  
  /**
   * 记录用户选择回复选项（类型检测）
   */
  async trackReplyOptionSelected(userId, agentId, optionData) {
    const profile = await this._getProfile(userId, agentId);
    const context = this._buildContext(profile);
    
    await UserEvent.track(userId, agentId, 'reply_option_selected', {
      replyStyle: optionData.style, // shy/normal/bold
      choiceIndex: optionData.index,
      round: optionData.round,
    }, {
      ...context,
      detectionRound: optionData.round,
    });
  }
  
  // ==================== 内容事件 ====================
  
  /**
   * 记录内容查看
   */
  async trackContentViewed(userId, agentId, contentData) {
    const profile = await this._getProfile(userId, agentId);
    const context = this._buildContext(profile);
    
    const eventType = contentData.type === 'video' ? 'video_played' : 'image_viewed';
    
    await UserEvent.track(userId, agentId, eventType, {
      contentId: contentData.contentId,
      contentType: contentData.type,
      contentLevel: contentData.level,
      source: contentData.source || 'gallery',
    }, context);
    
    // 更新内容表现
    const perf = await ContentPerformance.getOrCreate(
      contentData.contentId,
      contentData.type,
      agentId,
      { level: contentData.level }
    );
    await perf.recordView(userId);
    
    // 更新用户内容消费统计
    const updateField = contentData.type === 'video' 
      ? 'aiAnalysis.contentConsumption.totalVideosWatched'
      : 'aiAnalysis.contentConsumption.totalImagesViewed';
    
    await UserProfile.updateOne(
      { userId, agentId },
      { $inc: { [updateField]: 1 } }
    );
  }
  
  /**
   * 记录内容观看结束（带时长）
   */
  async trackContentViewEnd(userId, agentId, contentData) {
    const profile = await this._getProfile(userId, agentId);
    const context = this._buildContext(profile);
    
    await UserEvent.track(userId, agentId, 'image_viewed', {
      contentId: contentData.contentId,
      contentType: contentData.type,
      duration: contentData.duration,
      progress: contentData.progress, // 视频进度
    }, context);
    
    // 更新内容表现
    const perf = await ContentPerformance.findOne({ contentId: contentData.contentId });
    if (perf) {
      await perf.recordView(userId, contentData.duration);
      
      // 视频完成
      if (contentData.type === 'video' && contentData.progress >= 90) {
        await perf.recordInteraction('video_complete', { progress: contentData.progress });
        await UserEvent.track(userId, agentId, 'video_completed', {
          contentId: contentData.contentId,
          duration: contentData.duration,
        }, context);
      }
    }
  }
  
  /**
   * 记录内容互动（点赞/保存/分享）
   */
  async trackContentInteraction(userId, agentId, interactionData) {
    const profile = await this._getProfile(userId, agentId);
    const context = this._buildContext(profile);
    
    const eventType = interactionData.action === 'save' ? 'image_saved' 
      : interactionData.action === 'share' ? 'image_shared'
      : interactionData.action === 'like' ? 'content_liked'
      : 'content_disliked';
    
    await UserEvent.track(userId, agentId, eventType, {
      contentId: interactionData.contentId,
      contentType: interactionData.type,
      reaction: interactionData.action,
    }, context);
    
    // 更新内容表现
    const perf = await ContentPerformance.findOne({ contentId: interactionData.contentId });
    if (perf) {
      await perf.recordInteraction(interactionData.action);
    }
  }
  
  // ==================== 商业事件 ====================
  
  /**
   * 记录送礼
   */
  async trackGiftSent(userId, agentId, giftData) {
    const profile = await this._getProfile(userId, agentId);
    const context = this._buildContext(profile);
    
    await UserEvent.track(userId, agentId, 'gift_sent', {
      giftId: giftData.giftId,
      amount: giftData.price,
      source: giftData.source || 'chat',
    }, context);
    
    // 如果有关联内容，记录转化
    if (giftData.triggeredByContentId) {
      const perf = await ContentPerformance.findOne({ contentId: giftData.triggeredByContentId });
      if (perf) {
        await perf.recordConversion('gift', giftData.price);
      }
    }
    
    // 检查是否是首次送礼（里程碑）
    if (profile?.totalGiftCount === 0) {
      await UserProfile.updateOne(
        { userId, agentId },
        {
          $push: {
            milestones: {
              type: 'first_gift',
              achievedAt: new Date(),
              data: { giftId: giftData.giftId, price: giftData.price },
            }
          }
        }
      );
    }
  }
  
  /**
   * 记录解锁私房照
   */
  async trackOutfitUnlocked(userId, agentId, outfitData) {
    const profile = await this._getProfile(userId, agentId);
    const context = this._buildContext(profile);
    
    await UserEvent.track(userId, agentId, 'outfit_unlocked', {
      outfitId: outfitData.outfitId,
      contentLevel: outfitData.level,
      unlockMethod: outfitData.method, // 'coins', 'intimacy', 'gift'
      amount: outfitData.cost,
    }, context);
    
    // 更新内容表现
    const perf = await ContentPerformance.getOrCreate(
      outfitData.outfitId.toString(),
      'outfit',
      agentId,
      { level: outfitData.level }
    );
    await perf.recordInteraction('unlock');
  }
  
  /**
   * 记录充值
   */
  async trackCoinsPurchased(userId, agentId, purchaseData) {
    const profile = await this._getProfile(userId, agentId);
    const context = this._buildContext(profile);
    
    await UserEvent.track(userId, agentId, 'coins_purchased', {
      amount: purchaseData.amount,
      price: purchaseData.price,
      packageId: purchaseData.packageId,
    }, context);
    
    // 更新用户LTV
    await UserProfile.updateOne(
      { userId, agentId },
      {
        $inc: { 'aiAnalysis.spending.ltv': purchaseData.price },
        $set: { 
          'aiAnalysis.spending.lastPurchaseAt': new Date(),
        }
      }
    );
    
    // 更新LTV等级
    const updatedProfile = await UserProfile.findOne({ userId, agentId });
    const ltv = updatedProfile?.aiAnalysis?.spending?.ltv || 0;
    let ltvTier = 'free';
    if (ltv >= 1000) ltvTier = 'whale';
    else if (ltv >= 200) ltvTier = 'dolphin';
    else if (ltv > 0) ltvTier = 'minnow';
    
    await UserProfile.updateOne(
      { userId, agentId },
      { $set: { 'aiAnalysis.spending.ltvTier': ltvTier } }
    );
  }
  
  // ==================== 关系事件 ====================
  
  /**
   * 记录设置昵称
   */
  async trackPetNameSet(userId, agentId, petNameData) {
    const profile = await this._getProfile(userId, agentId);
    const context = this._buildContext(profile);
    
    await UserEvent.track(userId, agentId, 'pet_name_set', {
      petName: petNameData.petName,
      userCallsMe: petNameData.userCallsMe,
    }, context);
  }
  
  // ==================== 辅助方法 ====================
  
  async _getProfile(userId, agentId) {
    return UserProfile.findOne({ userId, agentId }).lean();
  }
  
  _buildContext(profile) {
    return {
      intimacy: profile?.intimacy || 0,
      userType: profile?.userType || 'unknown',
      detectionRound: profile?.detectionRound || 0,
      sessionId: profile?.currentSession?.sessionId,
      sessionDuration: profile?.currentSession?.startedAt
        ? Math.floor((Date.now() - new Date(profile.currentSession.startedAt).getTime()) / 1000)
        : 0,
      messageCount: profile?.currentSession?.messageCount || 0,
    };
  }
  
  _truncate(str, maxLength) {
    if (!str) return '';
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
  }
}

// 导出单例
module.exports = new EventCollector();
