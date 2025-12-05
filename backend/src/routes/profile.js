/**
 * 用户画像/专属昵称系统 API
 * 
 * - GET /api/profile/:agentId - 获取用户画像
 * - POST /api/profile/:agentId/pet-name - 设置专属昵称
 * - GET /api/profile/:agentId/relationship - 获取关系数据
 */

const express = require('express');
const router = express.Router();
const UserProfile = require('../models/UserProfile');
const relationshipService = require('../services/relationshipService');
const { sendSuccess, errors, HTTP_STATUS } = require('../utils/errorHandler');
const { requireAuth } = require('../middleware/auth');

// GET /api/profile/:agentId - 获取完整用户画像
router.get('/:agentId', requireAuth, async (req, res) => {
  const { agentId } = req.params;
  const userId = req.user.id;

  try {
    let profile = await UserProfile.findOne({ userId, agentId });
    
    if (!profile) {
      // 创建新画像
      profile = await UserProfile.create({ 
        userId, 
        agentId,
        firstMetAt: new Date()
      });
    }
    
    const intimacy = await relationshipService.getIntimacy(userId, agentId);
    
    // 计算在一起的天数
    const daysTogether = profile.firstMetAt 
      ? Math.floor((Date.now() - profile.firstMetAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    sendSuccess(res, HTTP_STATUS.OK, { 
      profile: profile.toObject(),
      intimacy,
      daysTogether
    });
  } catch (err) {
    console.error('Get Profile Error:', err);
    errors.internalError(res, 'Failed to get profile');
  }
});

// POST /api/profile/:agentId/pet-name - 设置专属昵称
router.post('/:agentId/pet-name', requireAuth, async (req, res) => {
  const { agentId } = req.params;
  const { petName, userCallsMe } = req.body;
  const userId = req.user.id;

  try {
    const updates = {};
    
    if (petName !== undefined) {
      updates.petName = petName;
      updates.petNameSetAt = new Date();
    }
    
    if (userCallsMe !== undefined) {
      updates.userCallsMe = userCallsMe;
    }
    
    if (Object.keys(updates).length === 0) {
      return errors.badRequest(res, 'petName or userCallsMe is required');
    }
    
    const profile = await UserProfile.findOneAndUpdate(
      { userId, agentId },
      { $set: updates },
      { upsert: true, new: true }
    );
    
    sendSuccess(res, HTTP_STATUS.OK, { 
      success: true,
      petName: profile.petName,
      userCallsMe: profile.userCallsMe,
      message: '专属昵称设置成功！'
    });
  } catch (err) {
    console.error('Set Pet Name Error:', err);
    errors.internalError(res, 'Failed to set pet name');
  }
});

// GET /api/profile/:agentId/relationship - 获取关系概览
router.get('/:agentId/relationship', requireAuth, async (req, res) => {
  const { agentId } = req.params;
  const userId = req.user.id;

  try {
    const profile = await UserProfile.findOne({ userId, agentId });
    const intimacy = await relationshipService.getIntimacy(userId, agentId);
    
    // 计算在一起的天数
    const daysTogether = profile?.firstMetAt 
      ? Math.floor((Date.now() - profile.firstMetAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    // 确定关系等级称号
    let relationshipTitle = '陌生人';
    if (intimacy >= 100) relationshipTitle = '灵魂伴侣 💕';
    else if (intimacy >= 80) relationshipTitle = '恋人 💗';
    else if (intimacy >= 60) relationshipTitle = '暧昧对象 💓';
    else if (intimacy >= 40) relationshipTitle = '好朋友 💛';
    else if (intimacy >= 20) relationshipTitle = '朋友 💚';
    else if (intimacy >= 5) relationshipTitle = '熟人 🤝';
    
    sendSuccess(res, HTTP_STATUS.OK, {
      intimacy,
      daysTogether,
      relationshipTitle,
      petName: profile?.petName || '',
      userCallsMe: profile?.userCallsMe || '',
      totalMessages: profile?.totalMessages || 0,
      totalGiftCount: profile?.totalGiftCount || 0,
      totalGiftCoins: profile?.totalGiftCoins || 0
    });
  } catch (err) {
    console.error('Get Relationship Error:', err);
    errors.internalError(res, 'Failed to get relationship');
  }
});

module.exports = router;
