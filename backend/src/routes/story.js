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
router.post('/continue', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.body;
    
    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return errors.badRequest(res, '无效的故事 ID');
    }
    
    // 检查并扣费
    try {
      await walletService.consume(userId, COST_CONTINUE, 'story_continue');
    } catch (walletErr) {
      return errors.badRequest(res, walletErr.message || '余额不足');
    }
    
    const result = await storyService.continueStory(sessionId);
    
    // 获取当前余额
    const balance = await walletService.getBalance(userId);
    
    console.log(`[Story API] Continue: sessionId=${sessionId}, progress=${result.progress}%`);
    
    sendSuccess(res, HTTP_STATUS.OK, {
      ...result,
      balance,
      cost: COST_CONTINUE,
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
router.post('/input', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId, userInput } = req.body;
    
    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return errors.badRequest(res, '无效的故事 ID');
    }
    
    if (!userInput || userInput.trim() === '') {
      return errors.badRequest(res, '请输入内容');
    }
    
    // 检查并扣费
    try {
      await walletService.consume(userId, COST_INPUT, 'story_input');
    } catch (walletErr) {
      return errors.badRequest(res, walletErr.message || '余额不足');
    }
    
    const result = await storyService.inputStory(sessionId, userInput.trim());
    
    // 获取当前余额
    const balance = await walletService.getBalance(userId);
    
    console.log(`[Story API] Input: sessionId=${sessionId}, input="${userInput.slice(0, 20)}..."`);
    
    sendSuccess(res, HTTP_STATUS.OK, {
      ...result,
      balance,
      cost: COST_INPUT,
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
