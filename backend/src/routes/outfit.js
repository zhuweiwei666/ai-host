/**
 * 衣服/场景系统 API
 * 
 * - GET /api/outfit/list/:agentId - 获取 AI 主播的所有衣服/场景
 * - POST /api/outfit/unlock - 解锁衣服/场景
 * - GET /api/outfit/unlocked/:agentId - 获取已解锁的衣服/场景
 */

const express = require('express');
const router = express.Router();
const Outfit = require('../models/Outfit');
const UserProfile = require('../models/UserProfile');
const walletService = require('../services/walletService');
const relationshipService = require('../services/relationshipService');
const { sendSuccess, errors, HTTP_STATUS } = require('../utils/response');

// GET /api/outfit/list/:agentId - 获取 AI 主播的所有衣服/场景（含解锁状态）
router.get('/list/:agentId', async (req, res) => {
  const { agentId } = req.params;
  
  if (!req.user || !req.user.id) {
    return errors.unauthorized(res);
  }
  const userId = req.user.id;

  try {
    // 获取所有衣服/场景
    const outfits = await Outfit.find({ agentId, isActive: true })
      .sort({ level: 1, sortOrder: 1 });
    
    // 获取用户的解锁状态和亲密度
    const profile = await UserProfile.findOne({ userId, agentId });
    const unlockedIds = (profile?.unlockedOutfits || []).map(id => id.toString());
    const intimacy = await relationshipService.getIntimacy(userId, agentId);
    
    // 标记每个衣服的解锁状态
    const outfitsWithStatus = outfits.map(outfit => {
      const outfitObj = outfit.toObject();
      let isUnlocked = false;
      let canUnlock = false;
      let unlockReason = '';
      
      // 检查是否已解锁
      if (unlockedIds.includes(outfit._id.toString())) {
        isUnlocked = true;
      } else {
        // 检查解锁条件
        switch (outfit.unlockType) {
          case 'free':
            isUnlocked = true;
            break;
          case 'intimacy':
            if (intimacy >= outfit.unlockValue) {
              isUnlocked = true;
            } else {
              unlockReason = `需要亲密度 ${outfit.unlockValue}（当前 ${intimacy}）`;
            }
            break;
          case 'coins':
            canUnlock = true;
            unlockReason = `需要 ${outfit.unlockValue} 金币`;
            break;
          case 'gift':
            unlockReason = '需要送特定礼物解锁';
            break;
        }
      }
      
      return {
        ...outfitObj,
        isUnlocked,
        canUnlock,
        unlockReason,
        // 未解锁时隐藏完整内容，只显示预览
        imageUrls: isUnlocked ? outfitObj.imageUrls : [],
        videoUrls: isUnlocked ? outfitObj.videoUrls : []
      };
    });
    
    sendSuccess(res, HTTP_STATUS.OK, { 
      outfits: outfitsWithStatus,
      intimacy 
    });
  } catch (err) {
    console.error('Get Outfit List Error:', err);
    errors.internalError(res, 'Failed to get outfit list');
  }
});

// POST /api/outfit/unlock - 用金币解锁衣服/场景
router.post('/unlock', async (req, res) => {
  const { agentId, outfitId } = req.body;
  
  if (!req.user || !req.user.id) {
    return errors.unauthorized(res);
  }
  const userId = req.user.id;
  
  if (!agentId || !outfitId) {
    return errors.badRequest(res, 'agentId and outfitId are required');
  }

  try {
    // 1. 获取衣服信息
    const outfit = await Outfit.findById(outfitId);
    if (!outfit || !outfit.isActive) {
      return errors.notFound(res, 'Outfit not found');
    }
    
    // 2. 检查是否已解锁
    const profile = await UserProfile.findOne({ userId, agentId });
    const unlockedIds = (profile?.unlockedOutfits || []).map(id => id.toString());
    if (unlockedIds.includes(outfitId)) {
      return errors.badRequest(res, '已经解锁过了');
    }
    
    // 3. 检查解锁类型
    if (outfit.unlockType !== 'coins') {
      // 检查亲密度解锁
      if (outfit.unlockType === 'intimacy') {
        const intimacy = await relationshipService.getIntimacy(userId, agentId);
        if (intimacy >= outfit.unlockValue) {
          // 亲密度够了，自动解锁
          await UserProfile.findOneAndUpdate(
            { userId, agentId },
            { $addToSet: { unlockedOutfits: outfitId } },
            { upsert: true }
          );
          return sendSuccess(res, HTTP_STATUS.OK, {
            success: true,
            outfit: outfit.toObject(),
            message: '亲密度达标，已自动解锁！'
          });
        } else {
          return errors.badRequest(res, `亲密度不足，需要 ${outfit.unlockValue}`);
        }
      }
      return errors.badRequest(res, '该衣服不支持金币解锁');
    }
    
    // 4. 检查余额
    const balance = await walletService.getBalance(userId);
    if (balance < outfit.unlockValue) {
      return errors.insufficientFunds(res, `需要 ${outfit.unlockValue} 金币`);
    }
    
    // 5. 扣费
    await walletService.spend(userId, outfit.unlockValue, `解锁衣服: ${outfit.name}`);
    
    // 6. 记录解锁
    await UserProfile.findOneAndUpdate(
      { userId, agentId },
      { $addToSet: { unlockedOutfits: outfitId } },
      { upsert: true }
    );
    
    // 7. 获取最新余额
    const newBalance = await walletService.getBalance(userId);
    
    sendSuccess(res, HTTP_STATUS.OK, {
      success: true,
      outfit: outfit.toObject(),
      balance: newBalance,
      message: `成功解锁「${outfit.name}」！`
    });
    
  } catch (err) {
    console.error('Unlock Outfit Error:', err);
    errors.internalError(res, 'Failed to unlock outfit', { error: err.message });
  }
});

// GET /api/outfit/unlocked/:agentId - 获取已解锁的衣服/场景
router.get('/unlocked/:agentId', async (req, res) => {
  const { agentId } = req.params;
  
  if (!req.user || !req.user.id) {
    return errors.unauthorized(res);
  }
  const userId = req.user.id;

  try {
    const profile = await UserProfile.findOne({ userId, agentId })
      .populate('unlockedOutfits');
    
    const unlockedOutfits = profile?.unlockedOutfits || [];
    
    sendSuccess(res, HTTP_STATUS.OK, { outfits: unlockedOutfits });
  } catch (err) {
    console.error('Get Unlocked Outfits Error:', err);
    errors.internalError(res, 'Failed to get unlocked outfits');
  }
});

module.exports = router;
