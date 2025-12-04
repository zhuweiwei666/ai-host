const express = require('express');
const router = express.Router();
const imageGenerationService = require('../services/imageGenerationService');
const walletService = require('../services/walletService');
const relationshipService = require('../services/relationshipService');
const Agent = require('../models/Agent');
const UsageLog = require('../models/UsageLog');
const costCalculator = require('../utils/costCalculator');
const { requireAuth } = require('../middleware/auth');
const { errors, sendSuccess, HTTP_STATUS } = require('../utils/errorHandler');

// 认证中间件
router.use(requireAuth);

/**
 * POST /api/generate-image
 * 
 * 简化后的生图逻辑：
 * 1. 获取 AI 主播的封面图 (avatarUrl)
 * 2. 结合用户发送的文案 (description)
 * 3. 使用 Img2Img 生成新图片
 * 
 * 请求体:
 * - agentId: AI 主播 ID（必需）
 * - description: 用户文案（必需）
 * - count: 生成数量（默认 1）
 * - strength: 生成强度 0-1（默认 0.65，值越小越接近原图）
 * - skipBalanceCheck: 跳过余额检查（管理员使用）
 */
router.post('/', async (req, res) => {
  const { 
    agentId, 
    description, 
    count = 1, 
    width = 768,
    height = 1152,
    skipBalanceCheck = false,
    userId 
  } = req.body;

  // 验证必需参数
  if (!agentId) {
    return errors.badRequest(res, 'agentId 是必需的');
  }
  if (!description) {
    return errors.badRequest(res, 'description 是必需的');
  }

  // 获取用户 ID
  const safeUserId = userId || req.user?.id;
  if (!safeUserId) {
    return errors.unauthorized(res);
  }

  try {
    // 1. 获取 AI 主播信息
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return errors.notFound(res, 'AI 主播不存在');
    }

    console.log(`[ImageGen] 用户 ${safeUserId} 请求生成图片`, {
      agent: agent.name,
      style: agent.style,
      description: description.substring(0, 30) + '...'
    });

    // 3. 扣费（10 金币/张）
    if (!skipBalanceCheck) {
      const COST_PER_IMAGE = 10;
      const totalCost = COST_PER_IMAGE * count;
      await walletService.consume(safeUserId, totalCost, 'ai_image', agentId);
    }

    // 4. 生成图片
    // 使用 Agent 的描述作为角色特征（发色、眼睛、服装等）
    const characterDescription = agent.description || agent.name;
    
    const results = await imageGenerationService.generate(description, {
      characterDescription,
      count,
      width,
      height,
      style: agent.style || 'realistic',
      model: 'pro'  // 使用最强模型
    });

    // 5. 记录使用日志 & 增加亲密度
    try {
      await relationshipService.updateIntimacy(safeUserId, agentId, 5);
      
      await UsageLog.create({
        agentId,
        userId: safeUserId,
        type: 'image',
        provider: 'fal',
        model: 'flux/dev/image-to-image',
        inputUnits: 0,
        outputUnits: count,
        cost: costCalculator.calculateImage('flux/dev', count)
      });
    } catch (logErr) {
      console.error('[ImageGen] 日志记录失败:', logErr.message);
    }

    // 6. 返回结果
    const finalIntimacy = await relationshipService.getIntimacy(safeUserId, agentId);
    const balance = await walletService.getBalance(safeUserId);

    sendSuccess(res, HTTP_STATUS.OK, {
      url: results[0].url,
      urls: results.map(r => r.url),
      balance,
      intimacy: finalIntimacy
    });

  } catch (error) {
    console.error('[ImageGen] 生成失败:', error.message);
    
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return errors.insufficientFunds(res);
    }
    
    errors.imageGenError(res, error.message || '图片生成失败', { 
      error: error.message 
    });
  }
});

module.exports = router;
