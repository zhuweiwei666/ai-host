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
const StorySession = require('../models/StorySession');
const Subscription = require('../models/Subscription');
const Agent = require('../models/Agent');
let StoryAttribution;
try { StoryAttribution = require('../models/StoryAttribution'); } catch { StoryAttribution = null; }

// 消耗配置
const COST_CONTINUE = 2;  // 继续剧情消耗
const COST_INPUT = 2;     // 用户输入消耗
const COST_CHAPTER_UNLOCK = 10; // 章解锁（一次性），每20段触发一次

async function getActiveSubscription(userId) {
  const now = new Date();
  return Subscription.findOne({
    userId: String(userId),
    status: { $in: ['active', 'trialing'] },
    $or: [{ currentPeriodEnd: { $exists: false } }, { currentPeriodEnd: null }, { currentPeriodEnd: { $gt: now } }],
  }).lean();
}

async function isSubscribed(userId) {
  const sub = await getActiveSubscription(userId);
  return !!sub;
}

async function loadAndAuthorizeSession(userId, sessionId) {
  const session = await StorySession.findById(sessionId);
  if (!session) return { session: null, forbidden: false };
  if (String(session.userId) !== String(userId)) return { session: null, forbidden: true };
  return { session, forbidden: false };
}

function isChapterLocked(session) {
  const pending = session?.state?.pay?.pending;
  if (!pending || pending.type !== 'chapter_unlock') return null;
  const unlocked = Number(session?.state?.pay?.unlockedChapterIndex || 0);
  if (Number(pending.chapterIndex || 0) > unlocked) return pending;
  return null;
}

function isMilestoneLocked(session) {
  const pending = session?.state?.pay?.pending;
  if (!pending || pending.type !== 'milestone_unlock') return null;
  const unlocked = Array.isArray(session?.state?.pay?.unlockedMilestones) ? session.state.pay.unlockedMilestones : [];
  const already = unlocked.some((x) => String(x.arcId) === String(pending.arcId) && String(x.milestoneId) === String(pending.milestoneId));
  return already ? null : pending;
}

function getPaywallLock(session) {
  return isMilestoneLocked(session) || isChapterLocked(session) || null;
}

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
    const { sessionId, generateImage = false, clientRequestId } = req.body; // 默认不生成图片（写真按钮未激活）
    
    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return errors.badRequest(res, '无效的故事 ID');
    }
    
    const subscribed = await isSubscribed(userId);

    // 鉴权 + 章解锁拦截（订阅用户跳过）
    const { session: ownedSession, forbidden } = await loadAndAuthorizeSession(userId, sessionId);
    if (forbidden) return errors.forbidden(res, '无权访问该故事');
    if (!ownedSession) return errors.notFound(res, '故事不存在');
    if (!subscribed) {
      const locked = getPaywallLock(ownedSession);
      if (locked) {
        console.log(`[Story API] Locked: sessionId=${sessionId}, type=${locked.type}`);
        const code = locked.type === 'milestone_unlock' ? 'MILESTONE_LOCKED' : 'CHAPTER_LOCKED';
        const cost = locked.type === 'milestone_unlock' ? (Number(locked.cost || 0) || COST_CHAPTER_UNLOCK) : COST_CHAPTER_UNLOCK;
        return errors.insufficientFunds(res, code, { paywall: locked, cost });
      }
    }

    // 根据是否生成图片确定费用（订阅折扣）
    const baseCost = subscribed ? 1 : COST_CONTINUE;
    const cost = subscribed
      ? (generateImage ? 2 : baseCost)
      : (generateImage ? COST_CONTINUE_WITH_IMAGE : baseCost);
    const imageCharge = generateImage ? Math.max(0, cost - baseCost) : 0;
    
    // 检查并扣费
    try {
      const idem = clientRequestId ? `story:continue:${sessionId}:${clientRequestId}` : null;
      await walletService.consume(userId, cost, generateImage ? 'story_continue_image' : 'story_continue', sessionId, idem);
    } catch (walletErr) {
      return errors.badRequest(res, walletErr.message || '余额不足');
    }
    
    const result = await storyService.continueStory(sessionId, { generateImage, imageCharge });
    
    // 获取当前余额
    const balance = await walletService.getBalance(userId);
    
    console.log(`[Story API] Continue: sessionId=${sessionId}, progress=${result.progress}%, imageGenerating=${result.imageGenerating}`);

    // Online tuning: use continue as light engagement signal
    try {
      const exp = await require('../models/PromptExperiment').getActiveExperiment(ownedSession.agentId);
      if (exp) {
        const v = exp.assignVariant(String(userId));
        await exp.recordMetric(v.id, 'message', 1);
      }
    } catch {}
    
    sendSuccess(res, HTTP_STATUS.OK, {
      ...result,
      balance,
      cost,
      subscribed,
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
    const { sessionId, userInput, generateImage = false, clientRequestId } = req.body; // 默认不生成图片（写真按钮未激活）
    
    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return errors.badRequest(res, '无效的故事 ID');
    }
    
    if (!userInput || userInput.trim() === '') {
      return errors.badRequest(res, '请输入内容');
    }
    
    const subscribed = await isSubscribed(userId);

    // 鉴权 + 章解锁拦截（订阅用户跳过）
    const { session: ownedSession, forbidden } = await loadAndAuthorizeSession(userId, sessionId);
    if (forbidden) return errors.forbidden(res, '无权访问该故事');
    if (!ownedSession) return errors.notFound(res, '故事不存在');
    if (!subscribed) {
      const locked = getPaywallLock(ownedSession);
      if (locked) {
        console.log(`[Story API] Locked: sessionId=${sessionId}, type=${locked.type}`);
        const code = locked.type === 'milestone_unlock' ? 'MILESTONE_LOCKED' : 'CHAPTER_LOCKED';
        const cost = locked.type === 'milestone_unlock' ? (Number(locked.cost || 0) || COST_CHAPTER_UNLOCK) : COST_CHAPTER_UNLOCK;
        return errors.insufficientFunds(res, code, { paywall: locked, cost });
      }
    }

    // 根据是否生成图片确定费用（订阅折扣）
    const baseCost = subscribed ? 1 : COST_INPUT;
    const cost = subscribed
      ? (generateImage ? 2 : baseCost)
      : (generateImage ? COST_INPUT_WITH_IMAGE : baseCost);
    const imageCharge = generateImage ? Math.max(0, cost - baseCost) : 0;
    
    // 检查并扣费
    try {
      const idem = clientRequestId ? `story:input:${sessionId}:${clientRequestId}` : null;
      await walletService.consume(userId, cost, generateImage ? 'story_input_image' : 'story_input', sessionId, idem);
    } catch (walletErr) {
      return errors.badRequest(res, walletErr.message || '余额不足');
    }
    
    const result = await storyService.inputStory(sessionId, userInput.trim(), { generateImage, imageCharge });
    
    // 获取当前余额
    const balance = await walletService.getBalance(userId);
    
    console.log(`[Story API] Input: sessionId=${sessionId}, input="${userInput.slice(0, 20)}...", imageGenerating=${result.imageGenerating}`);

    try {
      const exp = await require('../models/PromptExperiment').getActiveExperiment(ownedSession.agentId);
      if (exp) {
        const v = exp.assignVariant(String(userId));
        await exp.recordMetric(v.id, 'message', 1);
      }
    } catch {}
    
    sendSuccess(res, HTTP_STATUS.OK, {
      ...result,
      balance,
      cost,
      subscribed,
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
    const { sessionId, clientRequestId } = req.body;
    
    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return errors.badRequest(res, '无效的故事 ID');
    }
    
    // 检查并扣费
    const subscribed = await isSubscribed(userId);
    const cost = subscribed ? 2 : COST_PHOTO;
    try {
      const idem = clientRequestId ? `story:photo:${sessionId}:${clientRequestId}` : null;
      await walletService.consume(userId, cost, 'story_photo', sessionId, idem);
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
      cost,
      subscribed,
    });
  } catch (err) {
    console.error('[Story API] Photo error:', err);
    errors.badRequest(res, err.message || '生成写真失败');
  }
});

/**
 * POST /api/story/unlock-chapter
 * 解锁下一章（混合变现：章末强钩子）
 */
router.post('/unlock-chapter', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId, chapterIndex, clientRequestId } = req.body;

    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return errors.badRequest(res, '无效的故事 ID');
    }
    const { session: owned, forbidden } = await loadAndAuthorizeSession(userId, sessionId);
    if (forbidden) return errors.forbidden(res, '无权访问该故事');
    if (!owned) return errors.notFound(res, '故事不存在');

    const subscribed = await isSubscribed(userId);
    if (subscribed) {
      // 订阅用户视为已解锁
      owned.state.pay = owned.state.pay || {};
      owned.state.pay.unlockedChapterIndex = Math.max(Number(owned.state.pay.unlockedChapterIndex || 0), Number(chapterIndex || 0));
      // 清理 pending
      if (owned.state.pay.pending?.type === 'chapter_unlock') owned.state.pay.pending = undefined;
      await owned.save();
      const balance = await walletService.getBalance(userId);
      return sendSuccess(res, HTTP_STATUS.OK, { sessionId, chapterIndex, balance, cost: 0, subscribed: true });
    }

    const cost = COST_CHAPTER_UNLOCK;
    try {
      const idem = clientRequestId ? `story:unlock:${sessionId}:${clientRequestId}` : null;
      await walletService.consume(userId, cost, 'story_unlock_chapter', `${sessionId}:${chapterIndex}`, idem);
    } catch (walletErr) {
      return errors.badRequest(res, walletErr.message || '余额不足');
    }

    owned.state.pay = owned.state.pay || {};
    owned.state.pay.unlockedChapterIndex = Math.max(Number(owned.state.pay.unlockedChapterIndex || 0), Number(chapterIndex || 0));
    // 清理 pending（如果刚好解锁的是 pending 的那一章）
    if (owned.state.pay.pending?.type === 'chapter_unlock' && Number(owned.state.pay.pending.chapterIndex || 0) <= Number(chapterIndex || 0)) {
      owned.state.pay.pending = undefined;
    }
    await owned.save();

    const balance = await walletService.getBalance(userId);
    console.log(`[Story API] Chapter unlocked: sessionId=${sessionId}, chapterIndex=${chapterIndex}, cost=${cost}`);

    // Online tuning: treat unlock as high-value conversion signal
    try {
      const exp = await require('../models/PromptExperiment').getActiveExperiment(owned.agentId);
      if (exp) {
        const v = exp.assignVariant(String(userId));
        await exp.recordMetric(v.id, 'unlock', 1);
      }
    } catch {}

    return sendSuccess(res, HTTP_STATUS.OK, { sessionId, chapterIndex, balance, cost, subscribed: false });
  } catch (err) {
    console.error('[Story API] Unlock chapter error:', err);
    errors.badRequest(res, err.message || '解锁失败');
  }
});

/**
 * POST /api/story/unlock-milestone
 * 解锁里程碑（激情/越界/关键证据等）
 */
router.post('/unlock-milestone', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId, arcId, milestoneId, clientRequestId } = req.body;

    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return errors.badRequest(res, '无效的故事 ID');
    }
    if (!arcId || !milestoneId) return errors.badRequest(res, '缺少 arcId/milestoneId');

    const { session: owned, forbidden } = await loadAndAuthorizeSession(userId, sessionId);
    if (forbidden) return errors.forbidden(res, '无权访问该故事');
    if (!owned) return errors.notFound(res, '故事不存在');

    const subscribed = await isSubscribed(userId);
    if (subscribed) {
      owned.state.pay = owned.state.pay || {};
      if (!Array.isArray(owned.state.pay.unlockedMilestones)) owned.state.pay.unlockedMilestones = [];
      owned.state.pay.unlockedMilestones.push({ arcId: String(arcId), milestoneId: String(milestoneId), at: new Date() });
      if (owned.state.pay.pending?.type === 'milestone_unlock') owned.state.pay.pending = undefined;
      await owned.save();
      const balance = await walletService.getBalance(userId);
      return sendSuccess(res, HTTP_STATUS.OK, { sessionId, arcId, milestoneId, balance, cost: 0, subscribed: true });
    }

    // cost 从 skeleton 里取（兜底 12）
    let cost = 12;
    const agent = await Agent.findById(owned.agentId).lean();
    const sk = agent?.storyConfig?.skeleton;
    const arc = Array.isArray(sk?.arcs) ? sk.arcs.find((a) => String(a.arcId) === String(arcId)) : null;
    const ms = Array.isArray(arc?.milestones) ? arc.milestones.find((m) => String(m.id) === String(milestoneId)) : null;
    if (ms?.paywall?.cost) cost = Number(ms.paywall.cost) || cost;

    try {
      const idem = clientRequestId ? `story:unlock-milestone:${sessionId}:${clientRequestId}` : null;
      await walletService.consume(userId, cost, 'story_unlock_milestone', `${sessionId}:${arcId}:${milestoneId}`, idem);
    } catch (walletErr) {
      return errors.badRequest(res, walletErr.message || '余额不足');
    }

    owned.state.pay = owned.state.pay || {};
    if (!Array.isArray(owned.state.pay.unlockedMilestones)) owned.state.pay.unlockedMilestones = [];
    owned.state.pay.unlockedMilestones.push({ arcId: String(arcId), milestoneId: String(milestoneId), at: new Date() });
    if (owned.state.pay.pending?.type === 'milestone_unlock') owned.state.pay.pending = undefined;
    await owned.save();

    const balance = await walletService.getBalance(userId);
    console.log(`[Story API] Milestone unlocked: sessionId=${sessionId}, arcId=${arcId}, milestoneId=${milestoneId}, cost=${cost}`);

    try {
      const exp = await require('../models/PromptExperiment').getActiveExperiment(owned.agentId);
      if (exp) {
        const v = exp.assignVariant(String(userId));
        await exp.recordMetric(v.id, 'unlock', 1);
      }
    } catch {}

    return sendSuccess(res, HTTP_STATUS.OK, { sessionId, arcId, milestoneId, balance, cost, subscribed: false });
  } catch (err) {
    console.error('[Story API] Unlock milestone error:', err);
    errors.badRequest(res, err.message || '解锁失败');
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

/**
 * POST /api/story/feedback
 * 段落点赞/点踩 + 隐式时长
 */
router.post('/feedback', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId, paragraphIndex, thumb, dwellMs } = req.body;
    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) return errors.badRequest(res, '无效的故事 ID');
    const idx = Number(paragraphIndex);
    if (!Number.isFinite(idx) || idx < 0) return errors.badRequest(res, '无效的段落索引');
    if (thumb !== 'up' && thumb !== 'down') return errors.badRequest(res, 'thumb 必须是 up/down');

    if (StoryAttribution) {
      await StoryAttribution.updateOne(
        { sessionId, userId, paragraphIndex: idx },
        { $set: { thumb, dwellMs: Number.isFinite(Number(dwellMs)) ? Number(dwellMs) : undefined } },
        { upsert: true }
      );
    }

    // Online tuning: thumbs -> quality score sample
    const { session } = await loadAndAuthorizeSession(userId, sessionId);
    if (session) {
      const exp = await require('../models/PromptExperiment').getActiveExperiment(session.agentId);
      if (exp) {
        const v = exp.assignVariant(String(userId));
        const variant = exp.variants.find((x) => x.id === v.id);
        if (variant) {
          const n = variant.qualityScores.sampleCount || 0;
          const val = thumb === 'up' ? 1 : 0;
          variant.qualityScores.avgEngagement = (variant.qualityScores.avgEngagement * n + val) / (n + 1);
          variant.qualityScores.sampleCount = n + 1;
          await exp.save();
        }
      }
    }

    return sendSuccess(res, HTTP_STATUS.OK, { ok: true });
  } catch (err) {
    console.error('[Story API] Feedback error:', err);
    return errors.badRequest(res, err.message || '反馈失败');
  }
});

module.exports = router;
