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
const userAnalyzer = require('../services/userAnalyzer');
const recommendationEngine = require('../services/recommendationEngine');
const abTestService = require('../services/abTestService');
const paceController = require('../services/paceController');
const recallService = require('../services/recallService');
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

// ==================== 用户分析 ====================

// GET /api/analytics/users/segmentation - 用户分层统计
router.get('/users/segmentation', async (req, res) => {
  const { agentId } = req.query;
  
  try {
    const segmentation = await userAnalyzer.getUserSegmentation(agentId || null);
    sendSuccess(res, HTTP_STATUS.OK, segmentation);
  } catch (err) {
    console.error('User Segmentation Error:', err);
    errors.internalError(res, 'Failed to get user segmentation');
  }
});

// GET /api/analytics/users/churn-risk - 高流失风险用户
router.get('/users/churn-risk', async (req, res) => {
  const { limit = 100 } = req.query;
  
  try {
    const users = await userAnalyzer.getHighChurnRiskUsers(Number(limit));
    sendSuccess(res, HTTP_STATUS.OK, { 
      count: users.length,
      users 
    });
  } catch (err) {
    console.error('Churn Risk Users Error:', err);
    errors.internalError(res, 'Failed to get churn risk users');
  }
});

// GET /api/analytics/users/recall - 需要召回的用户
router.get('/users/recall', async (req, res) => {
  const { daysInactive = 3, limit = 100 } = req.query;
  
  try {
    const users = await userAnalyzer.getUsersForRecall(Number(daysInactive), Number(limit));
    sendSuccess(res, HTTP_STATUS.OK, { 
      count: users.length,
      users 
    });
  } catch (err) {
    console.error('Recall Users Error:', err);
    errors.internalError(res, 'Failed to get recall users');
  }
});

// GET /api/analytics/users/:userId/profile/:agentId - 获取用户详细画像
router.get('/users/:userId/profile/:agentId', async (req, res) => {
  const { userId, agentId } = req.params;
  
  try {
    // 触发分析更新
    const analysis = await userAnalyzer.analyzeUser(userId, agentId);
    
    // 获取完整画像
    const profile = await UserProfile.findOne({ userId, agentId })
      .populate('agentId', 'name')
      .lean();
    
    if (!profile) {
      return errors.notFound(res, 'User profile not found');
    }
    
    sendSuccess(res, HTTP_STATUS.OK, { 
      profile,
      freshAnalysis: !!analysis
    });
  } catch (err) {
    console.error('User Profile Error:', err);
    errors.internalError(res, 'Failed to get user profile');
  }
});

// ==================== 推荐系统 ====================

// GET /api/analytics/recommend/outfits/:agentId - 推荐私房照
router.get('/recommend/outfits/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const { limit = 5 } = req.query;
  
  if (!req.user || !req.user.id) {
    return errors.unauthorized(res);
  }
  const userId = req.user.id;
  
  try {
    const recommendations = await recommendationEngine.recommendOutfits(userId, agentId, Number(limit));
    sendSuccess(res, HTTP_STATUS.OK, { recommendations });
  } catch (err) {
    console.error('Recommend Outfits Error:', err);
    errors.internalError(res, 'Failed to get recommendations');
  }
});

// GET /api/analytics/recommend/gifts/:agentId - 推荐礼物
router.get('/recommend/gifts/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const { limit = 3 } = req.query;
  
  if (!req.user || !req.user.id) {
    return errors.unauthorized(res);
  }
  const userId = req.user.id;
  
  try {
    const recommendations = await recommendationEngine.recommendGifts(userId, agentId, Number(limit));
    sendSuccess(res, HTTP_STATUS.OK, { recommendations });
  } catch (err) {
    console.error('Recommend Gifts Error:', err);
    errors.internalError(res, 'Failed to get gift recommendations');
  }
});

// GET /api/analytics/recommend/strategy/:agentId - 获取对话策略推荐
router.get('/recommend/strategy/:agentId', async (req, res) => {
  const { agentId } = req.params;
  
  if (!req.user || !req.user.id) {
    return errors.unauthorized(res);
  }
  const userId = req.user.id;
  
  try {
    const strategy = await recommendationEngine.recommendConversationStrategy(userId, agentId);
    sendSuccess(res, HTTP_STATUS.OK, strategy);
  } catch (err) {
    console.error('Recommend Strategy Error:', err);
    errors.internalError(res, 'Failed to get conversation strategy');
  }
});

// ==================== A/B 测试 ====================

// GET /api/analytics/ab-test/list - 获取所有实验
router.get('/ab-test/list', async (req, res) => {
  const { agentId, status } = req.query;
  
  try {
    const experiments = await abTestService.listExperiments(agentId, status);
    sendSuccess(res, HTTP_STATUS.OK, { experiments });
  } catch (err) {
    console.error('List Experiments Error:', err);
    errors.internalError(res, 'Failed to list experiments');
  }
});

// GET /api/analytics/ab-test/:experimentId - 获取实验详情和结果
router.get('/ab-test/:experimentId', async (req, res) => {
  const { experimentId } = req.params;
  
  try {
    const results = await abTestService.getExperimentResults(experimentId);
    sendSuccess(res, HTTP_STATUS.OK, results);
  } catch (err) {
    console.error('Get Experiment Error:', err);
    errors.internalError(res, err.message);
  }
});

// POST /api/analytics/ab-test/create - 创建新实验
router.post('/ab-test/create', async (req, res) => {
  const { agentId, variants, name, description, minSampleSize } = req.body;
  
  if (!agentId || !variants || variants.length === 0) {
    return errors.badRequest(res, 'agentId and variants are required');
  }
  
  try {
    const experiment = await abTestService.createExperiment(agentId, variants, {
      name,
      description,
      minSampleSize,
      createdBy: req.user?.id || 'admin',
    });
    
    sendSuccess(res, HTTP_STATUS.CREATED, { experiment });
  } catch (err) {
    console.error('Create Experiment Error:', err);
    errors.internalError(res, err.message);
  }
});

// POST /api/analytics/ab-test/:experimentId/start - 启动实验
router.post('/ab-test/:experimentId/start', async (req, res) => {
  const { experimentId } = req.params;
  
  try {
    const experiment = await abTestService.startExperiment(experimentId);
    sendSuccess(res, HTTP_STATUS.OK, { experiment });
  } catch (err) {
    console.error('Start Experiment Error:', err);
    errors.internalError(res, err.message);
  }
});

// POST /api/analytics/ab-test/:experimentId/end - 结束实验
router.post('/ab-test/:experimentId/end', async (req, res) => {
  const { experimentId } = req.params;
  const { applyWinner = false } = req.body;
  
  try {
    const result = await abTestService.endExperiment(experimentId, applyWinner);
    sendSuccess(res, HTTP_STATUS.OK, result);
  } catch (err) {
    console.error('End Experiment Error:', err);
    errors.internalError(res, err.message);
  }
});

// POST /api/analytics/ab-test/:experimentId/apply - 应用赢家
router.post('/ab-test/:experimentId/apply', async (req, res) => {
  const { experimentId } = req.params;
  
  try {
    const result = await abTestService.applyWinner(experimentId);
    sendSuccess(res, HTTP_STATUS.OK, result);
  } catch (err) {
    console.error('Apply Winner Error:', err);
    errors.internalError(res, err.message);
  }
});

// GET /api/analytics/ab-test/suggest/:agentId - 生成优化变体建议
router.get('/ab-test/suggest/:agentId', async (req, res) => {
  const { agentId } = req.params;
  
  try {
    const suggestions = await abTestService.generateOptimizedVariants(agentId);
    sendSuccess(res, HTTP_STATUS.OK, suggestions);
  } catch (err) {
    console.error('Generate Suggestions Error:', err);
    errors.internalError(res, err.message);
  }
});

// ==================== 用户召回 ====================

// GET /api/analytics/recall/candidates - 获取召回候选用户
router.get('/recall/candidates', async (req, res) => {
  const { minDays = 3, maxDays = 14, limit = 100 } = req.query;
  
  try {
    const candidates = await recallService.getRecallCandidates({
      minDaysInactive: Number(minDays),
      maxDaysInactive: Number(maxDays),
      limit: Number(limit),
    });
    
    sendSuccess(res, HTTP_STATUS.OK, { 
      count: candidates.length,
      candidates 
    });
  } catch (err) {
    console.error('Get Recall Candidates Error:', err);
    errors.internalError(res, 'Failed to get recall candidates');
  }
});

// POST /api/analytics/recall/generate - 生成召回消息
router.post('/recall/generate', async (req, res) => {
  const { userId, agentId } = req.body;
  
  if (!userId || !agentId) {
    return errors.badRequest(res, 'userId and agentId are required');
  }
  
  try {
    const message = await recallService.generateRecallMessage(userId, agentId);
    if (!message) {
      return errors.notFound(res, 'User or agent not found');
    }
    sendSuccess(res, HTTP_STATUS.OK, message);
  } catch (err) {
    console.error('Generate Recall Error:', err);
    errors.internalError(res, 'Failed to generate recall message');
  }
});

// POST /api/analytics/recall/execute - 执行批量召回
router.post('/recall/execute', async (req, res) => {
  const { limit = 50 } = req.body;
  
  try {
    const result = await recallService.executeBatchRecall(Number(limit));
    sendSuccess(res, HTTP_STATUS.OK, result);
  } catch (err) {
    console.error('Execute Recall Error:', err);
    errors.internalError(res, 'Failed to execute recall');
  }
});

// GET /api/analytics/recall/effectiveness - 召回效果分析
router.get('/recall/effectiveness', async (req, res) => {
  const { days = 7 } = req.query;
  
  try {
    const results = await recallService.analyzeRecallEffectiveness(Number(days));
    sendSuccess(res, HTTP_STATUS.OK, results);
  } catch (err) {
    console.error('Recall Effectiveness Error:', err);
    errors.internalError(res, 'Failed to analyze recall effectiveness');
  }
});

// ==================== 尺度控制 ====================

// GET /api/analytics/pace/thresholds/:agentId - 获取个性化阈值
router.get('/pace/thresholds/:agentId', async (req, res) => {
  const { agentId } = req.params;
  
  if (!req.user || !req.user.id) {
    return errors.unauthorized(res);
  }
  const userId = req.user.id;
  
  try {
    const thresholds = await paceController.getPersonalizedThresholds(userId, agentId);
    sendSuccess(res, HTTP_STATUS.OK, thresholds);
  } catch (err) {
    console.error('Get Thresholds Error:', err);
    errors.internalError(res, 'Failed to get thresholds');
  }
});

// GET /api/analytics/pace/content-level/:agentId - 获取内容等级范围
router.get('/pace/content-level/:agentId', async (req, res) => {
  const { agentId } = req.params;
  
  if (!req.user || !req.user.id) {
    return errors.unauthorized(res);
  }
  const userId = req.user.id;
  
  try {
    const range = await paceController.getContentLevelRange(userId, agentId);
    sendSuccess(res, HTTP_STATUS.OK, range);
  } catch (err) {
    console.error('Get Content Level Error:', err);
    errors.internalError(res, 'Failed to get content level range');
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

// GET /api/analytics/tasks/list - 获取可用任务列表
router.get('/tasks/list', (req, res) => {
  const tasks = [
    { name: 'evaluateConversations', description: '评估待处理的对话' },
    { name: 'updateRecentScores', description: '更新最近内容分数' },
    { name: 'updateAllScores', description: '更新所有内容分数' },
    { name: 'deprecateUnderperforming', description: '标记表现不佳内容' },
    { name: 'generateContentReport', description: '生成内容日报' },
    { name: 'generateConversationReport', description: '生成对话日报' },
    { name: 'analyzeUsers', description: '分析用户画像' },
    { name: 'updateChurnRisks', description: '更新流失风险' },
    { name: 'updateThresholds', description: '更新个性化阈值' },
    { name: 'executeRecall', description: '执行用户召回' },
    { name: 'evaluateABTests', description: '评估A/B测试' },
    { name: 'recallEffectiveness', description: '分析召回效果' },
  ];
  
  sendSuccess(res, HTTP_STATUS.OK, { tasks });
});

module.exports = router;
