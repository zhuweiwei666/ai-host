/**
 * 分析仪表盘 API - AI自进化系统
 * 提供运营数据查看接口
 */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const UserEvent = require('../models/UserEvent');
const ContentPerformance = require('../models/ContentPerformance');
const ConversationAnalysis = require('../models/ConversationAnalysis');
const UserProfile = require('../models/UserProfile');
const Agent = require('../models/Agent');
const Message = require('../models/Message');
const contentAnalyzer = require('../services/contentAnalyzer');
const conversationEvaluator = require('../services/conversationEvaluator');
const scheduler = require('../jobs/scheduler');
const { sendSuccess, errors, HTTP_STATUS } = require('../utils/errorHandler');

// ==================== 仪表盘概览 ====================

// GET /api/analytics/dashboard - 获取仪表盘数据
router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const [
      // 今日活跃用户
      dau,
      // 本周活跃用户
      wau,
      // 今日新用户
      newUsersToday,
      // 今日消息数
      messagesToday,
      // 今日送礼次数
      giftsToday,
      // 活跃内容数
      activeContent,
      // 表现不佳内容数
      underperformingContent,
      // 待评估对话数
      pendingEvaluations,
      // 需要审核的对话数
      flaggedForReview
    ] = await Promise.all([
      UserEvent.distinct('userId', { 
        eventType: 'session_start', 
        serverTimestamp: { $gte: today } 
      }).then(ids => ids.length),
      
      UserEvent.distinct('userId', { 
        eventType: 'session_start', 
        serverTimestamp: { $gte: weekAgo } 
      }).then(ids => ids.length),
      
      UserProfile.countDocuments({ 
        createdAt: { $gte: today } 
      }),
      
      Message.countDocuments({ 
        createdAt: { $gte: today } 
      }),
      
      UserEvent.countDocuments({
        eventType: 'gift_sent',
        serverTimestamp: { $gte: today }
      }),
      
      ContentPerformance.countDocuments({ status: 'active' }),
      
      ContentPerformance.countDocuments({ status: 'underperforming' }),
      
      ConversationAnalysis.countDocuments({ evaluationStatus: 'pending' }),
      
      ConversationAnalysis.countDocuments({ flaggedForReview: true, reviewedAt: null })
    ]);
    
    // 昨日对比
    const dauYesterday = await UserEvent.distinct('userId', {
      eventType: 'session_start',
      serverTimestamp: { $gte: yesterday, $lt: today }
    }).then(ids => ids.length);
    
    sendSuccess(res, HTTP_STATUS.OK, {
      date: today.toISOString().split('T')[0],
      metrics: {
        dau,
        dauChange: dauYesterday > 0 ? Math.round(((dau - dauYesterday) / dauYesterday) * 100) : 0,
        wau,
        newUsersToday,
        messagesToday,
        giftsToday,
      },
      content: {
        activeContent,
        underperformingContent,
        underperformingRate: activeContent > 0 
          ? Math.round((underperformingContent / activeContent) * 100) 
          : 0
      },
      quality: {
        pendingEvaluations,
        flaggedForReview
      }
    });
  } catch (err) {
    console.error('Dashboard Error:', err);
    errors.internalError(res, 'Failed to get dashboard data');
  }
});

// ==================== 内容分析 ====================

// GET /api/analytics/content/overview/:agentId - 获取主播内容概览
router.get('/content/overview/:agentId', async (req, res) => {
  const { agentId } = req.params;
  
  try {
    const overview = await contentAnalyzer.getAgentContentOverview(agentId);
    const patterns = await contentAnalyzer.analyzeSuccessPatterns(agentId);
    
    sendSuccess(res, HTTP_STATUS.OK, { overview, patterns });
  } catch (err) {
    console.error('Content Overview Error:', err);
    errors.internalError(res, 'Failed to get content overview');
  }
});

// GET /api/analytics/content/underperforming - 获取表现不佳的内容
router.get('/content/underperforming', async (req, res) => {
  const { agentId, threshold = 30 } = req.query;
  
  try {
    const underperforming = await contentAnalyzer.identifyUnderperformingContent(
      Number(threshold),
      50
    );
    
    sendSuccess(res, HTTP_STATUS.OK, { 
      count: underperforming.length,
      contents: underperforming 
    });
  } catch (err) {
    console.error('Underperforming Content Error:', err);
    errors.internalError(res, 'Failed to get underperforming content');
  }
});

// ==================== 对话分析 ====================

// GET /api/analytics/conversation/scores/:agentId - 获取主播对话评分
router.get('/conversation/scores/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const { days = 7 } = req.query;
  
  try {
    const [avgScores, issueStats, reactionStats] = await Promise.all([
      conversationEvaluator.getAverageScores(agentId, Number(days)),
      conversationEvaluator.getIssueStats(agentId, Number(days)),
      ConversationAnalysis.getUserReactionStats(agentId, Number(days))
    ]);
    
    sendSuccess(res, HTTP_STATUS.OK, { 
      avgScores, 
      issueStats,
      reactionStats,
      period: `${days} days`
    });
  } catch (err) {
    console.error('Conversation Scores Error:', err);
    errors.internalError(res, 'Failed to get conversation scores');
  }
});

// GET /api/analytics/conversation/samples/:agentId - 获取低分对话样本
router.get('/conversation/samples/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const { limit = 20 } = req.query;
  
  try {
    const samples = await conversationEvaluator.getLowScoreSamples(agentId, Number(limit));
    
    sendSuccess(res, HTTP_STATUS.OK, { 
      count: samples.length,
      samples 
    });
  } catch (err) {
    console.error('Conversation Samples Error:', err);
    errors.internalError(res, 'Failed to get conversation samples');
  }
});

// GET /api/analytics/conversation/flagged - 获取需要审核的对话
router.get('/conversation/flagged', async (req, res) => {
  const { limit = 50 } = req.query;
  
  try {
    const flagged = await ConversationAnalysis.find({ 
      flaggedForReview: true, 
      reviewedAt: null 
    })
      .populate('agentId', 'name')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();
    
    sendSuccess(res, HTTP_STATUS.OK, { 
      count: flagged.length,
      conversations: flagged 
    });
  } catch (err) {
    console.error('Flagged Conversations Error:', err);
    errors.internalError(res, 'Failed to get flagged conversations');
  }
});

// POST /api/analytics/conversation/:id/review - 审核对话
router.post('/conversation/:id/review', async (req, res) => {
  const { id } = req.params;
  const { notes, resolved = true } = req.body;
  
  try {
    const analysis = await ConversationAnalysis.findByIdAndUpdate(
      id,
      {
        reviewedBy: req.user?.id || 'admin',
        reviewedAt: new Date(),
        reviewNotes: notes,
        flaggedForReview: !resolved
      },
      { new: true }
    );
    
    if (!analysis) {
      return errors.notFound(res, 'Conversation not found');
    }
    
    sendSuccess(res, HTTP_STATUS.OK, { analysis });
  } catch (err) {
    console.error('Review Conversation Error:', err);
    errors.internalError(res, 'Failed to review conversation');
  }
});

// ==================== Prompt 优化 ====================

// GET /api/analytics/prompt/optimization/:agentId - 获取Prompt优化建议
router.get('/prompt/optimization/:agentId', async (req, res) => {
  const { agentId } = req.params;
  
  try {
    const optimization = await conversationEvaluator.generatePromptOptimization(agentId);
    
    if (optimization.error) {
      return errors.internalError(res, optimization.error);
    }
    
    sendSuccess(res, HTTP_STATUS.OK, optimization);
  } catch (err) {
    console.error('Prompt Optimization Error:', err);
    errors.internalError(res, 'Failed to generate optimization');
  }
});

// ==================== 用户事件 ====================

// GET /api/analytics/events/stats - 获取事件统计
router.get('/events/stats', async (req, res) => {
  const { days = 7 } = req.query;
  const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
  
  try {
    const stats = await UserEvent.aggregate([
      { $match: { serverTimestamp: { $gte: since } } },
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          eventType: '$_id',
          count: 1,
          uniqueUsers: { $size: '$uniqueUsers' }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    sendSuccess(res, HTTP_STATUS.OK, { 
      period: `${days} days`,
      stats 
    });
  } catch (err) {
    console.error('Event Stats Error:', err);
    errors.internalError(res, 'Failed to get event stats');
  }
});

// ==================== 报告 ====================

// GET /api/analytics/report/content - 获取内容日报
router.get('/report/content', async (req, res) => {
  try {
    const report = await contentAnalyzer.generateDailyReport();
    sendSuccess(res, HTTP_STATUS.OK, report);
  } catch (err) {
    console.error('Content Report Error:', err);
    errors.internalError(res, 'Failed to generate content report');
  }
});

// GET /api/analytics/report/conversation - 获取对话日报
router.get('/report/conversation', async (req, res) => {
  try {
    const report = await conversationEvaluator.generateDailyReport();
    sendSuccess(res, HTTP_STATUS.OK, report);
  } catch (err) {
    console.error('Conversation Report Error:', err);
    errors.internalError(res, 'Failed to generate conversation report');
  }
});

// ==================== 手动触发任务 ====================

// POST /api/analytics/tasks/run - 手动执行后台任务
router.post('/tasks/run', async (req, res) => {
  const { taskName } = req.body;
  
  if (!taskName) {
    return errors.badRequest(res, 'taskName is required');
  }
  
  try {
    console.log(`[Analytics API] 手动触发任务: ${taskName}`);
    const result = await scheduler.runManually(taskName);
    
    sendSuccess(res, HTTP_STATUS.OK, { 
      task: taskName,
      result 
    });
  } catch (err) {
    console.error('Run Task Error:', err);
    errors.internalError(res, err.message);
  }
});

module.exports = router;
