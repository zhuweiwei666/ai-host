/**
 * 故事模式 API 路由
 * 
 * 论坛式剧情推进模式
 * 
 * - POST /api/story/start - 开始新故事
 * - POST /api/story/continue - AI 自动推进
 * - POST /api/story/input - 用户输入推进
 * - GET /api/story/:sessionId - 获取故事状态
 * - POST /api/story/restart - 重新开始
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const { sendSuccess, errors, HTTP_STATUS } = require('../utils/errorHandler');
const storyService = require('../services/storyService');
const walletService = require('../services/walletService');

// 消耗配置
const COST_CONTINUE = 2;  // 继续剧情消耗
const COST_INPUT = 2;     // 用户输入消耗

/**
 * POST /api/story/start
 * 开始新故事
 */
router.post('/start', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { agentId } = req.body;
    
    if (!agentId || !mongoose.Types.ObjectId.isValid(agentId)) {
      return errors.badRequest(res, '无效的角色 ID');
    }
    
    const result = await storyService.startStory(userId, agentId);
    
    console.log(`[Story API] Start: userId=${userId}, agentId=${agentId}, isExisting=${result.isExisting}`);
    
    sendSuccess(res, HTTP_STATUS.OK, result);
  } catch (err) {
    console.error('[Story API] Start error:', err);
    errors.badRequest(res, err.message || '开始故事失败');
  }
});

/**
 * POST /api/story/continue
 * AI 自动推进剧情
 */
// 消耗配置 - 带图片时额外消耗
const COST_CONTINUE_WITH_IMAGE = 5;  // 带情境图的继续剧情消耗

router.post('/continue', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId, generateImage = false } = req.body; // 默认不生成图片（写真按钮未激活）
    
    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return errors.badRequest(res, '无效的故事 ID');
    }
    
    // 根据是否生成图片确定费用
    const cost = generateImage ? COST_CONTINUE_WITH_IMAGE : COST_CONTINUE;
    
    // 检查并扣费
    try {
      await walletService.consume(userId, cost, generateImage ? 'story_continue_image' : 'story_continue');
    } catch (walletErr) {
      return errors.badRequest(res, walletErr.message || '余额不足');
    }
    
    const result = await storyService.continueStory(sessionId, { generateImage });
    
    // 获取当前余额
    const balance = await walletService.getBalance(userId);
    
    console.log(`[Story API] Continue: sessionId=${sessionId}, progress=${result.progress}%, imageGenerating=${result.imageGenerating}`);
    
    sendSuccess(res, HTTP_STATUS.OK, {
      ...result,
      balance,
      cost,
    });
  } catch (err) {
    console.error('[Story API] Continue error:', err);
    errors.badRequest(res, err.message || '推进剧情失败');
  }
});

/**
 * POST /api/story/input
 * 用户输入推进剧情
 */
// 消耗配置 - 带图片时额外消耗
const COST_INPUT_WITH_IMAGE = 5;  // 带情境图的用户输入消耗

router.post('/input', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId, userInput, generateImage = false } = req.body; // 默认不生成图片（写真按钮未激活）
    
    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return errors.badRequest(res, '无效的故事 ID');
    }
    
    if (!userInput || userInput.trim() === '') {
      return errors.badRequest(res, '请输入内容');
    }
    
    // 根据是否生成图片确定费用
    const cost = generateImage ? COST_INPUT_WITH_IMAGE : COST_INPUT;
    
    // 检查并扣费
    try {
      await walletService.consume(userId, cost, generateImage ? 'story_input_image' : 'story_input');
    } catch (walletErr) {
      return errors.badRequest(res, walletErr.message || '余额不足');
    }
    
    const result = await storyService.inputStory(sessionId, userInput.trim(), { generateImage });
    
    // 获取当前余额
    const balance = await walletService.getBalance(userId);
    
    console.log(`[Story API] Input: sessionId=${sessionId}, input="${userInput.slice(0, 20)}...", imageGenerating=${result.imageGenerating}`);
    
    sendSuccess(res, HTTP_STATUS.OK, {
      ...result,
      balance,
      cost,
    });
  } catch (err) {
    console.error('[Story API] Input error:', err);
    errors.badRequest(res, err.message || '处理输入失败');
  }
});

/**
 * GET /api/story/:sessionId
 * 获取故事状态
 */
router.get('/:sessionId', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return errors.badRequest(res, '无效的故事 ID');
    }
    
    const result = await storyService.getStoryState(sessionId);
    
    sendSuccess(res, HTTP_STATUS.OK, result);
  } catch (err) {
    console.error('[Story API] Get state error:', err);
    errors.badRequest(res, err.message || '获取故事状态失败');
  }
});

/**
 * POST /api/story/restart
 * 重新开始故事
 */
router.post('/restart', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { agentId } = req.body;
    
    if (!agentId || !mongoose.Types.ObjectId.isValid(agentId)) {
      return errors.badRequest(res, '无效的角色 ID');
    }
    
    const result = await storyService.restartStory(userId, agentId);
    
    console.log(`[Story API] Restart: userId=${userId}, agentId=${agentId}`);
    
    sendSuccess(res, HTTP_STATUS.OK, result);
  } catch (err) {
    console.error('[Story API] Restart error:', err);
    errors.badRequest(res, err.message || '重新开始失败');
  }
});

/**
 * POST /api/story/photo
 * 生成角色写真
 */
const COST_PHOTO = 5;  // 生成写真消耗

router.post('/photo', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.body;
    
    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return errors.badRequest(res, '无效的故事 ID');
    }
    
    // 检查并扣费
    try {
      await walletService.consume(userId, COST_PHOTO, 'story_photo');
    } catch (walletErr) {
      return errors.badRequest(res, walletErr.message || '余额不足');
    }
    
    const result = await storyService.generatePhoto(sessionId);
    
    // 获取当前余额
    const balance = await walletService.getBalance(userId);
    
    console.log(`[Story API] Photo: sessionId=${sessionId}`);
    
    sendSuccess(res, HTTP_STATUS.OK, {
      ...result,
      balance,
      cost: COST_PHOTO,
    });
  } catch (err) {
    console.error('[Story API] Photo error:', err);
    errors.badRequest(res, err.message || '生成写真失败');
  }
});

/**
 * GET /api/story/:sessionId/image/:index
 * 获取段落图片状态（用于轮询）
 */
router.get('/:sessionId/image/:index', requireAuth, async (req, res) => {
  try {
    const { sessionId, index } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return errors.badRequest(res, '无效的故事 ID');
    }
    
    const paragraphIndex = parseInt(index, 10);
    if (isNaN(paragraphIndex) || paragraphIndex < 0) {
      return errors.badRequest(res, '无效的段落索引');
    }
    
    const result = await storyService.getParagraphImage(sessionId, paragraphIndex);
    
    sendSuccess(res, HTTP_STATUS.OK, result);
  } catch (err) {
    console.error('[Story API] Get image error:', err);
    errors.badRequest(res, err.message || '获取图片失败');
  }
});

/**
 * GET /api/story/user/sessions
 * 获取用户所有活跃的故事
 */
router.get('/user/sessions', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const StorySession = require('../models/StorySession');
    
    const sessions = await StorySession.find({ userId, status: 'active' })
      .populate('agentId', 'name avatarUrls')
      .select('agentId progress totalParagraphs updatedAt')
      .sort({ updatedAt: -1 });
    
    sendSuccess(res, HTTP_STATUS.OK, sessions);
  } catch (err) {
    console.error('[Story API] Get user sessions error:', err);
    errors.internalError(res, '获取故事列表失败');
  }
});

module.exports = router;
