/**
 * LiveSkin FSM API
 * 
 * 视频状态机资产管理和事件上报接口
 * 
 * - GET /api/liveskin/manifest/:agentId - 获取完整 FSM 资产清单
 * - POST /api/liveskin/video/:agentId - 添加/更新视频资产
 * - PUT /api/liveskin/video/:agentId/:videoId - 更新视频 FSM 元数据
 * - POST /api/liveskin/event - 上报 FSM 事件（统计用）
 * - GET /api/liveskin/stats/:agentId - 获取 FSM 播放统计
 */

const express = require('express');
const router = express.Router();
const Agent = require('../models/Agent');
const UserEvent = require('../models/UserEvent');
const { sendSuccess, errors, HTTP_STATUS } = require('../utils/errorHandler');
const { requireAuth } = require('../middleware/auth');

// 管理员检查中间件
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return errors.forbidden(res, 'Admin access required');
  }
  next();
};

/**
 * GET /api/liveskin/manifest/:agentId
 * 获取完整 FSM 资产清单（供 iOS/Web 客户端使用）
 * 
 * 返回格式：
 * {
 *   agentId: string,
 *   version: number,
 *   assets: {
 *     idle: VideoAsset[],
 *     reactions: { [emotionId]: VideoAsset[] },
 *     transitions: VideoAsset[],
 *     speak: VideoAsset[]
 *   },
 *   defaultIdleIndex: number
 * }
 */
router.get('/manifest/:agentId', async (req, res) => {
  const { agentId } = req.params;
  
  try {
    const agent = await Agent.findById(agentId).select('name previewVideos defaultPreviewIndex liveSkinStatus');
    
    if (!agent) {
      return errors.notFound(res, 'Agent not found');
    }
    
    const videos = agent.previewVideos || [];
    
    // 按 assetType 分类
    const idle = [];
    const reactions = {};
    const transitions = [];
    const speak = [];
    
    videos.forEach((v, index) => {
      const asset = {
        id: v._id.toString(),
        url: v.url,
        loopSafeUrl: v.loopSafeUrl || '',
        thumbnailUrl: v.thumbnailUrl || '',
        duration: v.duration || 0,
        width: v.width || 0,
        height: v.height || 0,
        safeCutPoints: v.safeCutPoints || [],
        poseId: v.poseId || 'neutral',
        emotionId: v.emotionId || '',
        fromPose: v.fromPose || '',
        toPose: v.toPose || '',
        loopSafe: v.loopSafe || false,
        tags: v.tags || [],
        scaleLevel: v.scaleLevel || 1,
        sortOrder: v.sortOrder || index,
      };
      
      switch (v.assetType) {
        case 'idle':
          idle.push(asset);
          break;
        case 'reaction':
          const emotionKey = v.emotionId || 'default';
          if (!reactions[emotionKey]) {
            reactions[emotionKey] = [];
          }
          reactions[emotionKey].push(asset);
          break;
        case 'transition':
          transitions.push(asset);
          break;
        case 'speak':
          speak.push(asset);
          break;
        default:
          // 未分类的默认为 idle
          idle.push(asset);
      }
    });
    
    // 按 sortOrder 排序
    idle.sort((a, b) => a.sortOrder - b.sortOrder);
    transitions.sort((a, b) => a.sortOrder - b.sortOrder);
    speak.sort((a, b) => a.sortOrder - b.sortOrder);
    Object.keys(reactions).forEach(key => {
      reactions[key].sort((a, b) => a.sortOrder - b.sortOrder);
    });
    
    const manifest = {
      agentId: agent._id.toString(),
      agentName: agent.name,
      version: 1, // 可以后续改为从 agent 读取
      status: agent.liveSkinStatus || 'pending',
      assets: {
        idle,
        reactions,
        transitions,
        speak,
      },
      defaultIdleIndex: agent.defaultPreviewIndex || 0,
      totalAssets: videos.length,
      generatedAt: new Date().toISOString(),
    };
    
    sendSuccess(res, HTTP_STATUS.OK, manifest);
  } catch (error) {
    console.error('[LiveSkin] Error getting manifest:', error);
    errors.internalError(res, 'Failed to get LiveSkin manifest');
  }
});

/**
 * PUT /api/liveskin/video/:agentId/:videoId
 * 更新视频的 FSM 元数据（管理员）
 */
router.put('/video/:agentId/:videoId', requireAuth, requireAdmin, async (req, res) => {
  const { agentId, videoId } = req.params;
  const updates = req.body;
  
  try {
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return errors.notFound(res, 'Agent not found');
    }
    
    const video = agent.previewVideos.id(videoId);
    if (!video) {
      return errors.notFound(res, 'Video not found');
    }
    
    // 允许更新的 FSM 字段
    const allowedFields = [
      'assetType', 'loopSafe', 'loopSafeUrl', 'safeCutPoints',
      'poseId', 'emotionId', 'fromPose', 'toPose', 'duration'
    ];
    
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        video[field] = updates[field];
      }
    });
    
    // 如果设置为 idle 类型，自动标记为可循环并设置 loopSafeUrl
    if (updates.assetType === 'idle') {
      video.loopSafe = true;
      video.loopSafeUrl = video.loopSafeUrl || video.url; // 使用原 URL 作为循环 URL
      video.safeCutPoints = video.safeCutPoints?.length ? video.safeCutPoints : [0];
      video.poseId = video.poseId || 'neutral';
      
      // 更新 Agent 的 liveSkinStatus
      agent.liveSkinStatus = 'ready';
    }
    
    await agent.save();
    
    sendSuccess(res, HTTP_STATUS.OK, {
      message: 'Video FSM metadata updated',
      video: {
        id: video._id,
        url: video.url,
        assetType: video.assetType,
        emotionId: video.emotionId,
        loopSafe: video.loopSafe,
        safeCutPoints: video.safeCutPoints,
        poseId: video.poseId,
      }
    });
  } catch (error) {
    console.error('[LiveSkin] Error updating video:', error);
    errors.internalError(res, 'Failed to update video');
  }
});

/**
 * POST /api/liveskin/event
 * 上报 FSM 事件（客户端统计用）
 * 
 * Body:
 * {
 *   agentId: string,
 *   eventType: 'reaction_queued' | 'reaction_played' | 'reaction_skipped' | 'fsm_state_change',
 *   data: {
 *     emotionId?: string,
 *     latencyMs?: number,
 *     skipReason?: string,
 *     fromState?: string,
 *     toState?: string,
 *     trigger?: string,
 *     videoAssetId?: string,
 *   },
 *   timestamp?: string  // 客户端时间戳
 * }
 */
router.post('/event', requireAuth, async (req, res) => {
  const { agentId, eventType, data = {}, timestamp } = req.body;
  const userId = req.user?.id || req.user?.userId;
  
  if (!agentId || !eventType) {
    return errors.badRequest(res, 'Missing agentId or eventType');
  }
  
  const validEventTypes = ['reaction_queued', 'reaction_played', 'reaction_skipped', 'fsm_state_change'];
  if (!validEventTypes.includes(eventType)) {
    return errors.badRequest(res, 'Invalid eventType');
  }
  
  try {
    // 构建事件数据
    const eventData = {};
    
    if (eventType === 'fsm_state_change') {
      eventData.fsmStateChange = {
        fromState: data.fromState,
        toState: data.toState,
        trigger: data.trigger,
      };
    } else {
      eventData.reactionData = {
        emotionId: data.emotionId,
        latencyMs: data.latencyMs,
        skipReason: data.skipReason,
        fsmState: data.fsmState,
        videoAssetId: data.videoAssetId,
        queuedAt: data.queuedAt ? new Date(data.queuedAt) : undefined,
        playedAt: data.playedAt ? new Date(data.playedAt) : undefined,
      };
    }
    
    // 记录事件
    await UserEvent.track(userId, agentId, eventType, eventData, {
      platform: req.headers['x-platform'] || 'unknown',
      deviceType: req.headers['x-device-type'] || 'unknown',
    });
    
    sendSuccess(res, HTTP_STATUS.OK, { recorded: true });
  } catch (error) {
    console.error('[LiveSkin] Error recording event:', error);
    // 事件记录失败不应阻塞客户端
    sendSuccess(res, HTTP_STATUS.OK, { recorded: false, error: 'Failed to record event' });
  }
});

/**
 * GET /api/liveskin/stats/:agentId
 * 获取 FSM 播放统计（管理员）
 */
router.get('/stats/:agentId', requireAuth, requireAdmin, async (req, res) => {
  const { agentId } = req.params;
  const { days = 7 } = req.query;
  
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const stats = await UserEvent.aggregate([
      {
        $match: {
          agentId: require('mongoose').Types.ObjectId(agentId),
          eventType: { $in: ['reaction_queued', 'reaction_played', 'reaction_skipped'] },
          serverTimestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            eventType: '$eventType',
            emotionId: '$data.reactionData.emotionId'
          },
          count: { $sum: 1 },
          avgLatencyMs: { $avg: '$data.reactionData.latencyMs' }
        }
      },
      {
        $group: {
          _id: '$_id.eventType',
          emotions: {
            $push: {
              emotionId: '$_id.emotionId',
              count: '$count',
              avgLatencyMs: '$avgLatencyMs'
            }
          },
          total: { $sum: '$count' }
        }
      }
    ]);
    
    // 计算整体指标
    const played = stats.find(s => s._id === 'reaction_played');
    const queued = stats.find(s => s._id === 'reaction_queued');
    const skipped = stats.find(s => s._id === 'reaction_skipped');
    
    const summary = {
      period: `${days} days`,
      totalQueued: queued?.total || 0,
      totalPlayed: played?.total || 0,
      totalSkipped: skipped?.total || 0,
      playRate: queued?.total ? ((played?.total || 0) / queued.total * 100).toFixed(1) + '%' : 'N/A',
      avgLatencyMs: played?.emotions?.length 
        ? Math.round(played.emotions.reduce((sum, e) => sum + (e.avgLatencyMs || 0), 0) / played.emotions.length)
        : null,
    };
    
    sendSuccess(res, HTTP_STATUS.OK, {
      summary,
      details: stats,
    });
  } catch (error) {
    console.error('[LiveSkin] Error getting stats:', error);
    errors.internalError(res, 'Failed to get stats');
  }
});

/**
 * POST /api/liveskin/batch-update/:agentId
 * 批量更新视频的 assetType（根据 tags 自动推断）
 */
router.post('/batch-update/:agentId', requireAuth, requireAdmin, async (req, res) => {
  const { agentId } = req.params;
  
  try {
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return errors.notFound(res, 'Agent not found');
    }
    
    // 标签到 assetType 的映射
    const tagToAssetType = {
      idle: 'idle',
      loopable: 'idle',
      talk: 'speak',
      listen: 'speak',
      happy: 'reaction',
      excited: 'reaction',
      flirty: 'reaction',
      shy: 'reaction',
      love: 'reaction',
      proud: 'reaction',
      sad: 'reaction',
      angry: 'reaction',
      surprised: 'reaction',
      scared: 'reaction',
      confused: 'reaction',
      bored: 'reaction',
    };
    
    // 情绪标签列表
    const emotionTags = ['happy', 'excited', 'flirty', 'shy', 'love', 'proud', 'sad', 'angry', 'surprised', 'scared', 'confused', 'bored'];
    
    let updated = 0;
    
    let hasIdleVideo = false;
    
    agent.previewVideos.forEach(video => {
      const tags = video.tags || [];
      
      // 根据第一个匹配的标签推断 assetType
      for (const tag of tags) {
        if (tagToAssetType[tag]) {
          video.assetType = tagToAssetType[tag];
          
          // 如果是 idle 类型，自动设置循环相关字段
          if (tagToAssetType[tag] === 'idle') {
            video.loopSafe = true;
            video.loopSafeUrl = video.loopSafeUrl || video.url;
            video.safeCutPoints = video.safeCutPoints?.length ? video.safeCutPoints : [0];
            video.poseId = video.poseId || 'neutral';
            hasIdleVideo = true;
          }
          
          // 如果是 reaction 类型，设置 emotionId
          if (tagToAssetType[tag] === 'reaction' && emotionTags.includes(tag)) {
            video.emotionId = tag;
          }
          
          updated++;
          break;
        }
      }
    });
    
    // 如果有 idle 视频，更新 liveSkinStatus
    if (hasIdleVideo) {
      agent.liveSkinStatus = 'ready';
    }
    
    await agent.save();
    
    sendSuccess(res, HTTP_STATUS.OK, {
      message: `Updated ${updated} videos based on tags`,
      total: agent.previewVideos.length,
    });
  } catch (error) {
    console.error('[LiveSkin] Error batch updating:', error);
    errors.internalError(res, 'Failed to batch update');
  }
});

module.exports = router;
