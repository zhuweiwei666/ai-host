/**
 * 衣服/场景系统 API
 * 
 * - GET /api/outfit/list/:agentId - 获取 AI 主播的所有衣服/场景
 * - POST /api/outfit/unlock - 解锁衣服/场景
 * - GET /api/outfit/unlocked/:agentId - 获取已解锁的衣服/场景
 * - POST /api/outfit/generate-images/:outfitId - 为衣服生成图片（管理员）
 * - POST /api/outfit/generate-all/:agentId - 为主播所有衣服生成图片（管理员）
 */

const express = require('express');
const router = express.Router();
const Outfit = require('../models/Outfit');
const Agent = require('../models/Agent');
const UserProfile = require('../models/UserProfile');
const walletService = require('../services/walletService');
const relationshipService = require('../services/relationshipService');
const imageGenerationService = require('../services/imageGenerationService');
const eventCollector = require('../services/eventCollector'); // AI自进化系统 - 事件收集
const { sendSuccess, errors, HTTP_STATUS } = require('../utils/errorHandler');
const { requireAuth } = require('../middleware/auth');

// GET /api/outfit/list/:agentId - 获取 AI 主播的所有衣服/场景（含解锁状态）
router.get('/list/:agentId', requireAuth, async (req, res) => {
  const { agentId } = req.params;
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
router.post('/unlock', requireAuth, async (req, res) => {
  const { agentId, outfitId } = req.body;
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
          
          // 🔔 事件埋点：亲密度解锁私房照
          eventCollector.trackOutfitUnlocked(userId, agentId, {
            outfitId: outfit._id,
            level: outfit.level,
            method: 'intimacy',
            cost: 0
          }).catch(err => console.error('[Event] Outfit unlock error:', err.message));
          
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
    
    // 🔔 事件埋点：解锁私房照
    eventCollector.trackOutfitUnlocked(userId, agentId, {
      outfitId: outfit._id,
      level: outfit.level,
      method: 'coins',
      cost: outfit.unlockValue
    }).catch(err => console.error('[Event] Outfit unlock error:', err.message));
    
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
router.get('/unlocked/:agentId', requireAuth, async (req, res) => {
  const { agentId } = req.params;
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

// ==================== 管理员 API：生成图片 ====================

/**
 * 根据 Outfit 的级别和名称生成合适的 prompt
 */
function generatePromptForOutfit(outfit, agentName, agentStyle) {
  const isAnime = agentStyle === 'anime';
  const baseStyle = isAnime ? 'anime style, ' : 'photorealistic, ';
  
  // 根据级别生成不同尺度的 prompt
  const levelPrompts = {
    1: { // 日常
      '居家休闲': `${baseStyle}${agentName} wearing comfortable home clothes, cozy living room, relaxed pose, soft lighting`,
      '清纯学生装': `${baseStyle}${agentName} wearing school uniform, classroom background, innocent smile, bright lighting`,
      'default': `${baseStyle}${agentName} in casual outfit, natural pose, soft lighting`
    },
    2: { // 性感
      '小礼服': `${baseStyle}${agentName} wearing elegant cocktail dress, showing collarbone and shoulders, glamorous, party lighting`,
      '紧身瑜伽服': `${baseStyle}${agentName} wearing tight yoga outfit, fitness pose, athletic body, gym lighting`,
      'default': `${baseStyle}${agentName} in sexy outfit, alluring pose, dramatic lighting`
    },
    3: { // 暴露
      '性感睡衣': `${baseStyle}${agentName} wearing lace lingerie nightgown, bedroom, seductive pose, soft romantic lighting`,
      '比基尼': `${baseStyle}${agentName} wearing bikini, beach background, summer vibes, golden hour lighting`,
      '黑丝OL': `${baseStyle}${agentName} wearing office suit with black stockings, professional yet sexy, office background`,
      'default': `${baseStyle}${agentName} in revealing outfit, sensual pose, intimate lighting`
    },
    4: { // 大尺度
      '情趣内衣': `${baseStyle}${agentName} wearing sexy lingerie, bedroom setting, seductive expression, intimate lighting`,
      '浴巾围身': `${baseStyle}${agentName} wrapped in towel after shower, bathroom, wet hair, steamy atmosphere`,
      '女仆装': `${baseStyle}${agentName} wearing short maid outfit, bending forward, playful pose, home setting`,
      'default': `${baseStyle}${agentName} in provocative outfit, very sensual pose, intimate setting`
    },
    5: { // 极限
      '全裸围裙': `${baseStyle}${agentName} wearing only an apron, kitchen background, cooking, back view, teasing`,
      '床上诱惑': `${baseStyle}${agentName} lying on bed, covered partially with sheets, bedroom, romantic mood, soft lighting`,
      'default': `${baseStyle}${agentName} in very revealing state, extremely sensual, artistic nude style`
    }
  };
  
  const levelMap = levelPrompts[outfit.level] || levelPrompts[1];
  return levelMap[outfit.name] || levelMap['default'];
}

// POST /api/outfit/generate-images/:outfitId - 为单个衣服生成图片
router.post('/generate-images/:outfitId', async (req, res) => {
  const { outfitId } = req.params;
  const { count = 1 } = req.body; // 生成几张图片
  
  // 这里可以添加管理员权限验证
  // if (!req.user?.isAdmin) return errors.forbidden(res);

  try {
    const outfit = await Outfit.findById(outfitId);
    if (!outfit) {
      return errors.notFound(res, 'Outfit not found');
    }
    
    const agent = await Agent.findById(outfit.agentId);
    if (!agent) {
      return errors.notFound(res, 'Agent not found');
    }
    
    // 获取参考图
    const referenceImage = agent.avatarUrls?.[0] || agent.avatarUrl;
    if (!referenceImage) {
      return errors.badRequest(res, '主播没有头像，无法生成图片');
    }
    
    // 生成 prompt
    const prompt = generatePromptForOutfit(outfit, agent.name, agent.style);
    console.log(`[Outfit] 生成图片: ${outfit.name}, prompt: ${prompt}`);
    
    // 根据级别调整 strength（级别越高，变化越大）
    const strengthByLevel = { 1: 0.6, 2: 0.65, 3: 0.7, 4: 0.75, 5: 0.8 };
    const strength = strengthByLevel[outfit.level] || 0.7;
    
    // 调用图片生成服务
    const results = await imageGenerationService.generate(prompt, {
      referenceImage,
      count: Math.min(count, 4), // 最多4张
      width: 768,
      height: 1152,
      strength,
      style: agent.style || 'realistic'
    });
    
    // 更新 Outfit
    const newImageUrls = results.map(r => r.url);
    outfit.imageUrls = [...(outfit.imageUrls || []), ...newImageUrls];
    
    // 如果没有预览图，用第一张作为预览图
    if (!outfit.previewUrl && newImageUrls.length > 0) {
      outfit.previewUrl = newImageUrls[0];
    }
    
    await outfit.save();
    
    sendSuccess(res, HTTP_STATUS.OK, {
      success: true,
      outfit: outfit.toObject(),
      generated: newImageUrls.length,
      message: `成功生成 ${newImageUrls.length} 张图片`
    });
    
  } catch (err) {
    console.error('Generate Outfit Images Error:', err);
    errors.internalError(res, '图片生成失败', { error: err.message });
  }
});

// POST /api/outfit/generate-all/:agentId - 为主播所有没有图片的衣服生成图片
router.post('/generate-all/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const { countPerOutfit = 1 } = req.body;
  
  // 这里可以添加管理员权限验证

  try {
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return errors.notFound(res, 'Agent not found');
    }
    
    const referenceImage = agent.avatarUrls?.[0] || agent.avatarUrl;
    if (!referenceImage) {
      return errors.badRequest(res, '主播没有头像，无法生成图片');
    }
    
    // 获取所有没有图片的衣服
    const outfits = await Outfit.find({ 
      agentId, 
      isActive: true,
      $or: [
        { imageUrls: { $exists: false } },
        { imageUrls: { $size: 0 } }
      ]
    }).sort({ level: 1, sortOrder: 1 });
    
    if (outfits.length === 0) {
      return sendSuccess(res, HTTP_STATUS.OK, {
        success: true,
        message: '所有衣服都已有图片',
        generated: 0
      });
    }
    
    console.log(`[Outfit] 开始为 ${agent.name} 生成 ${outfits.length} 套衣服的图片`);
    
    const results = [];
    const strengthByLevel = { 1: 0.6, 2: 0.65, 3: 0.7, 4: 0.75, 5: 0.8 };
    
    for (const outfit of outfits) {
      try {
        const prompt = generatePromptForOutfit(outfit, agent.name, agent.style);
        const strength = strengthByLevel[outfit.level] || 0.7;
        
        console.log(`[Outfit] 生成: ${outfit.name} (Level ${outfit.level})`);
        
        const genResults = await imageGenerationService.generate(prompt, {
          referenceImage,
          count: Math.min(countPerOutfit, 2),
          width: 768,
          height: 1152,
          strength,
          style: agent.style || 'realistic'
        });
        
        const newImageUrls = genResults.map(r => r.url);
        outfit.imageUrls = newImageUrls;
        outfit.previewUrl = newImageUrls[0];
        await outfit.save();
        
        results.push({
          name: outfit.name,
          level: outfit.level,
          generated: newImageUrls.length,
          success: true
        });
        
        // 添加延迟避免 API 限流
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (err) {
        console.error(`[Outfit] 生成失败 ${outfit.name}:`, err.message);
        results.push({
          name: outfit.name,
          level: outfit.level,
          success: false,
          error: err.message
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    sendSuccess(res, HTTP_STATUS.OK, {
      success: true,
      agentName: agent.name,
      total: outfits.length,
      generated: successCount,
      failed: outfits.length - successCount,
      details: results,
      message: `成功为 ${successCount}/${outfits.length} 套衣服生成图片`
    });
    
  } catch (err) {
    console.error('Generate All Outfit Images Error:', err);
    errors.internalError(res, '批量生成失败', { error: err.message });
  }
});

// GET /api/outfit/admin/list/:agentId - 管理员获取衣服列表（包含所有信息）
router.get('/admin/list/:agentId', async (req, res) => {
  const { agentId } = req.params;
  
  try {
    const outfits = await Outfit.find({ agentId })
      .sort({ level: 1, sortOrder: 1 });
    
    const agent = await Agent.findById(agentId);
    
    sendSuccess(res, HTTP_STATUS.OK, { 
      outfits,
      agent: agent ? { name: agent.name, avatarUrl: agent.avatarUrls?.[0] || agent.avatarUrl } : null
    });
  } catch (err) {
    console.error('Admin Get Outfit List Error:', err);
    errors.internalError(res, 'Failed to get outfit list');
  }
});

module.exports = router;
