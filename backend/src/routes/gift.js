/**
 * 礼物系统 API
 * 
 * - GET /api/gift/list - 获取所有礼物
 * - POST /api/gift/send - 送礼物
 * - GET /api/gift/history/:agentId - 获取送礼历史
 */

const express = require('express');
const router = express.Router();
const Gift = require('../models/Gift');
const GiftLog = require('../models/GiftLog');
const UserProfile = require('../models/UserProfile');
const Agent = require('../models/Agent');
const Message = require('../models/Message');
const walletService = require('../services/walletService');
const relationshipService = require('../services/relationshipService');
const { sendSuccess, errors, HTTP_STATUS } = require('../utils/errorHandler');

// GET /api/gift/list - 获取所有可用礼物
router.get('/list', async (req, res) => {
  try {
    const gifts = await Gift.find({ isActive: true }).sort({ sortOrder: 1, price: 1 });
    sendSuccess(res, HTTP_STATUS.OK, { gifts });
  } catch (err) {
    console.error('Get Gift List Error:', err);
    errors.internalError(res, 'Failed to get gift list');
  }
});

// POST /api/gift/send - 送礼物给 AI 主播
router.post('/send', async (req, res) => {
  const { agentId, giftId } = req.body;
  
  if (!req.user || !req.user.id) {
    return errors.unauthorized(res);
  }
  const userId = req.user.id;
  
  if (!agentId || !giftId) {
    return errors.badRequest(res, 'agentId and giftId are required');
  }

  try {
    // 1. 获取礼物信息
    const gift = await Gift.findById(giftId);
    if (!gift || !gift.isActive) {
      return errors.notFound(res, 'Gift not found');
    }
    
    // 2. 检查余额
    const balance = await walletService.getBalance(userId);
    if (balance < gift.price) {
      return errors.insufficientFunds(res, `需要 ${gift.price} 金币，当前余额 ${balance}`);
    }
    
    // 3. 获取 AI 主播信息
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return errors.notFound(res, 'Agent not found');
    }
    
    // 4. 扣费
    await walletService.spend(userId, gift.price, `送礼物给${agent.name}: ${gift.name}`);
    
    // 5. 增加亲密度
    if (gift.intimacyBonus > 0) {
      await relationshipService.updateIntimacy(userId, agentId, gift.intimacyBonus);
    }
    
    // 6. 生成 AI 回复
    let aiResponse = '';
    if (gift.responseTemplates && gift.responseTemplates.length > 0) {
      // 随机选择一个模板
      const template = gift.responseTemplates[Math.floor(Math.random() * gift.responseTemplates.length)];
      aiResponse = template.replace('{gift}', gift.name).replace('{emoji}', gift.emoji);
    } else {
      // 默认回复
      const responses = [
        `哇！${gift.emoji} 谢谢你送我${gift.name}！好开心~`,
        `${gift.emoji} 收到你的${gift.name}了！你对我真好~`,
        `${gift.emoji} 哎呀，${gift.name}！你是不是对我有意思呀？`,
        `${gift.emoji} 太喜欢这个${gift.name}了！给你一个么么哒~`,
      ];
      aiResponse = responses[Math.floor(Math.random() * responses.length)];
    }
    
    // 7. 保存礼物记录
    const giftLog = await GiftLog.create({
      userId,
      agentId,
      giftId: gift._id,
      giftName: gift.name,
      giftEmoji: gift.emoji,
      price: gift.price,
      intimacyBonus: gift.intimacyBonus,
      aiResponse
    });
    
    // 8. 更新用户画像的礼物统计
    await UserProfile.findOneAndUpdate(
      { userId, agentId },
      { 
        $inc: { 
          totalGiftCoins: gift.price, 
          totalGiftCount: 1 
        }
      },
      { upsert: true }
    );
    
    // 9. 将 AI 回复作为消息保存到聊天记录
    await Message.create({
      agentId,
      userId,
      role: 'assistant',
      content: aiResponse
    });
    
    // 10. 获取最新余额和亲密度
    const newBalance = await walletService.getBalance(userId);
    const newIntimacy = await relationshipService.getIntimacy(userId, agentId);
    
    sendSuccess(res, HTTP_STATUS.OK, {
      success: true,
      gift: {
        name: gift.name,
        emoji: gift.emoji,
        price: gift.price
      },
      aiResponse,
      balance: newBalance,
      intimacy: newIntimacy,
      intimacyBonus: gift.intimacyBonus
    });
    
  } catch (err) {
    console.error('Send Gift Error:', err);
    errors.internalError(res, 'Failed to send gift', { error: err.message });
  }
});

// GET /api/gift/history/:agentId - 获取送礼历史
router.get('/history/:agentId', async (req, res) => {
  const { agentId } = req.params;
  
  if (!req.user || !req.user.id) {
    return errors.unauthorized(res);
  }
  const userId = req.user.id;

  try {
    const logs = await GiftLog.find({ userId, agentId })
      .sort({ createdAt: -1 })
      .limit(50);
    
    // 统计
    const stats = await GiftLog.aggregate([
      { $match: { userId, agentId: require('mongoose').Types.ObjectId(agentId) } },
      { 
        $group: { 
          _id: null, 
          totalGifts: { $sum: 1 },
          totalSpent: { $sum: '$price' }
        } 
      }
    ]);
    
    sendSuccess(res, HTTP_STATUS.OK, { 
      logs,
      stats: stats[0] || { totalGifts: 0, totalSpent: 0 }
    });
  } catch (err) {
    console.error('Get Gift History Error:', err);
    errors.internalError(res, 'Failed to get gift history');
  }
});

module.exports = router;
