/**
 * 视频预览 API
 * 
 * 用于悬停播放主播视频功能
 * 
 * - GET /api/preview/videos/:agentId - 获取主播预览视频列表
 * - GET /api/preview/video/:agentId/:index - 获取单个预览视频
 * - POST /api/preview/videos/:agentId - 添加预览视频（管理员）
 * - PUT /api/preview/videos/:agentId/:videoId - 更新预览视频（管理员）
 * - DELETE /api/preview/videos/:agentId/:videoId - 删除预览视频（管理员）
 * - POST /api/preview/videos/:agentId/reorder - 重新排序视频（管理员）
 * - POST /api/preview/videos/:agentId/migrate - 从 coverVideoUrls 迁移（管理员）
 */

const express = require('express');
const router = express.Router();
const Agent = require('../models/Agent');
const { sendSuccess, errors, HTTP_STATUS } = require('../utils/errorHandler');
const { requireAuth, requireAdmin } = require('../middleware/auth');

/**
 * GET /api/preview/videos/:agentId
 * 获取主播预览视频列表
 * 
 * Query 参数:
 * - maxScale: 最大尺度等级（1-5），默认返回所有
 * - tag: 筛选特定标签
 * - limit: 返回数量限制
 */
router.get('/videos/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const { maxScale, tag, limit } = req.query;
  
  try {
    const agent = await Agent.findById(agentId).select('name previewVideos coverVideoUrls defaultPreviewIndex avatarUrls');
    
    if (!agent) {
      return errors.notFound(res, 'Agent not found');
    }
    
    let videos = [];
    
    // 优先使用新的 previewVideos 字段
    if (agent.previewVideos && agent.previewVideos.length > 0) {
      videos = agent.previewVideos.map((v, index) => ({
        id: v._id,
        url: v.url,
        thumbnailUrl: v.thumbnailUrl || agent.avatarUrls?.[0] || '',
        duration: v.duration,
        width: v.width,
        height: v.height,
        fileSize: v.fileSize,
        format: v.format,
        isVertical: v.isVertical,
        sortOrder: v.sortOrder,
        tags: v.tags || [],
        scaleLevel: v.scaleLevel,
        index
      }));
    } 
    // 兼容旧的 coverVideoUrls 字段
    else if (agent.coverVideoUrls && agent.coverVideoUrls.length > 0) {
      videos = agent.coverVideoUrls.map((url, index) => ({
        id: `legacy_${index}`,
        url,
        thumbnailUrl: agent.avatarUrls?.[index] || agent.avatarUrls?.[0] || '',
        duration: 0,
        width: 0,
        height: 0,
        fileSize: 0,
        format: 'mp4',
        isVertical: true,
        sortOrder: index,
        tags: [],
        scaleLevel: 1,
        index
      }));
    }
    
    // 筛选尺度等级
    if (maxScale) {
      const maxScaleNum = parseInt(maxScale);
      videos = videos.filter(v => v.scaleLevel <= maxScaleNum);
    }
    
    // 筛选标签
    if (tag) {
      videos = videos.filter(v => v.tags.includes(tag));
    }
    
    // 排序
    videos.sort((a, b) => a.sortOrder - b.sortOrder);
    
    // 限制数量
    if (limit) {
      videos = videos.slice(0, parseInt(limit));
    }
    
    sendSuccess(res, HTTP_STATUS.OK, {
      agentId,
      agentName: agent.name,
      videos,
      defaultIndex: agent.defaultPreviewIndex || 0,
      totalCount: videos.length
    });
    
  } catch (err) {
    console.error('Get Preview Videos Error:', err);
    errors.internalError(res, 'Failed to get preview videos');
  }
});

/**
 * GET /api/preview/video/:agentId/:index
 * 获取单个预览视频（按索引）
 */
router.get('/video/:agentId/:index', async (req, res) => {
  const { agentId, index } = req.params;
  const idx = parseInt(index);
  
  try {
    const agent = await Agent.findById(agentId).select('previewVideos coverVideoUrls avatarUrls');
    
    if (!agent) {
      return errors.notFound(res, 'Agent not found');
    }
    
    let video = null;
    
    // 优先使用新的 previewVideos 字段
    if (agent.previewVideos && agent.previewVideos.length > idx) {
      const v = agent.previewVideos[idx];
      video = {
        id: v._id,
        url: v.url,
        thumbnailUrl: v.thumbnailUrl || agent.avatarUrls?.[0] || '',
        duration: v.duration,
        width: v.width,
        height: v.height,
        format: v.format,
        isVertical: v.isVertical,
        tags: v.tags || [],
        scaleLevel: v.scaleLevel
      };
    }
    // 兼容旧的 coverVideoUrls
    else if (agent.coverVideoUrls && agent.coverVideoUrls.length > idx) {
      video = {
        id: `legacy_${idx}`,
        url: agent.coverVideoUrls[idx],
        thumbnailUrl: agent.avatarUrls?.[idx] || agent.avatarUrls?.[0] || '',
        duration: 0,
        width: 0,
        height: 0,
        format: 'mp4',
        isVertical: true,
        tags: [],
        scaleLevel: 1
      };
    }
    
    if (!video) {
      return errors.notFound(res, 'Video not found at index');
    }
    
    sendSuccess(res, HTTP_STATUS.OK, { video });
    
  } catch (err) {
    console.error('Get Preview Video Error:', err);
    errors.internalError(res, 'Failed to get preview video');
  }
});

/**
 * GET /api/preview/random/:agentId
 * 获取随机预览视频
 */
router.get('/random/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const { maxScale } = req.query;
  
  try {
    const agent = await Agent.findById(agentId).select('previewVideos coverVideoUrls avatarUrls');
    
    if (!agent) {
      return errors.notFound(res, 'Agent not found');
    }
    
    let videos = [];
    
    if (agent.previewVideos && agent.previewVideos.length > 0) {
      videos = agent.previewVideos;
      
      // 筛选尺度
      if (maxScale) {
        videos = videos.filter(v => v.scaleLevel <= parseInt(maxScale));
      }
    } else if (agent.coverVideoUrls && agent.coverVideoUrls.length > 0) {
      videos = agent.coverVideoUrls.map((url, index) => ({
        url,
        thumbnailUrl: agent.avatarUrls?.[index] || agent.avatarUrls?.[0] || '',
        scaleLevel: 1
      }));
    }
    
    if (videos.length === 0) {
      return errors.notFound(res, 'No videos available');
    }
    
    // 随机选择一个
    const randomIndex = Math.floor(Math.random() * videos.length);
    const v = videos[randomIndex];
    
    sendSuccess(res, HTTP_STATUS.OK, {
      video: {
        url: v.url,
        thumbnailUrl: v.thumbnailUrl || agent.avatarUrls?.[0] || '',
        duration: v.duration || 0,
        isVertical: v.isVertical !== false,
        scaleLevel: v.scaleLevel || 1
      }
    });
    
  } catch (err) {
    console.error('Get Random Preview Video Error:', err);
    errors.internalError(res, 'Failed to get random video');
  }
});

/**
 * POST /api/preview/videos/:agentId
 * 添加预览视频（管理员）
 */
router.post('/videos/:agentId', requireAuth, requireAdmin, async (req, res) => {
  const { agentId } = req.params;
  const { url, thumbnailUrl, duration, width, height, fileSize, format, isVertical, tags, scaleLevel } = req.body;
  
  if (!url) {
    return errors.badRequest(res, 'url is required');
  }
  
  try {
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return errors.notFound(res, 'Agent not found');
    }
    
    // 计算新的 sortOrder
    const maxSortOrder = agent.previewVideos?.length > 0 
      ? Math.max(...agent.previewVideos.map(v => v.sortOrder || 0))
      : -1;
    
    const newVideo = {
      url,
      thumbnailUrl: thumbnailUrl || '',
      duration: duration || 0,
      width: width || 0,
      height: height || 0,
      fileSize: fileSize || 0,
      format: format || 'mp4',
      isVertical: isVertical !== false,
      sortOrder: maxSortOrder + 1,
      tags: tags || [],
      scaleLevel: scaleLevel || 1
    };
    
    agent.previewVideos.push(newVideo);
    await agent.save();
    
    const addedVideo = agent.previewVideos[agent.previewVideos.length - 1];
    
    sendSuccess(res, HTTP_STATUS.CREATED, {
      video: {
        id: addedVideo._id,
        ...newVideo
      }
    });
    
  } catch (err) {
    console.error('Add Preview Video Error:', err);
    errors.internalError(res, 'Failed to add preview video');
  }
});

/**
 * PUT /api/preview/videos/:agentId/:videoId
 * 更新预览视频（管理员）
 */
router.put('/videos/:agentId/:videoId', requireAuth, requireAdmin, async (req, res) => {
  const { agentId, videoId } = req.params;
  const updates = req.body;
  
  try {
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return errors.notFound(res, 'Agent not found');
    }
    
    const videoIndex = agent.previewVideos.findIndex(v => v._id.toString() === videoId);
    if (videoIndex === -1) {
      return errors.notFound(res, 'Video not found');
    }
    
    // 更新允许的字段
    const allowedFields = ['url', 'thumbnailUrl', 'duration', 'width', 'height', 'fileSize', 'format', 'isVertical', 'sortOrder', 'tags', 'scaleLevel'];
    
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        agent.previewVideos[videoIndex][field] = updates[field];
      }
    });
    
    await agent.save();
    
    sendSuccess(res, HTTP_STATUS.OK, {
      video: agent.previewVideos[videoIndex]
    });
    
  } catch (err) {
    console.error('Update Preview Video Error:', err);
    errors.internalError(res, 'Failed to update preview video');
  }
});

/**
 * DELETE /api/preview/videos/:agentId/:videoId
 * 删除预览视频（管理员）
 */
router.delete('/videos/:agentId/:videoId', requireAuth, requireAdmin, async (req, res) => {
  const { agentId, videoId } = req.params;
  
  try {
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return errors.notFound(res, 'Agent not found');
    }
    
    const videoIndex = agent.previewVideos.findIndex(v => v._id.toString() === videoId);
    if (videoIndex === -1) {
      return errors.notFound(res, 'Video not found');
    }
    
    agent.previewVideos.splice(videoIndex, 1);
    await agent.save();
    
    sendSuccess(res, HTTP_STATUS.OK, { success: true });
    
  } catch (err) {
    console.error('Delete Preview Video Error:', err);
    errors.internalError(res, 'Failed to delete preview video');
  }
});

/**
 * POST /api/preview/videos/:agentId/reorder
 * 重新排序视频（管理员）
 */
router.post('/videos/:agentId/reorder', requireAuth, requireAdmin, async (req, res) => {
  const { agentId } = req.params;
  const { videoIds } = req.body; // 按新顺序排列的 videoId 数组
  
  if (!videoIds || !Array.isArray(videoIds)) {
    return errors.badRequest(res, 'videoIds array is required');
  }
  
  try {
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return errors.notFound(res, 'Agent not found');
    }
    
    // 更新 sortOrder
    videoIds.forEach((videoId, index) => {
      const video = agent.previewVideos.find(v => v._id.toString() === videoId);
      if (video) {
        video.sortOrder = index;
      }
    });
    
    await agent.save();
    
    sendSuccess(res, HTTP_STATUS.OK, { success: true });
    
  } catch (err) {
    console.error('Reorder Preview Videos Error:', err);
    errors.internalError(res, 'Failed to reorder videos');
  }
});

/**
 * POST /api/preview/videos/:agentId/migrate
 * 从 coverVideoUrls 迁移到 previewVideos（管理员）
 */
router.post('/videos/:agentId/migrate', requireAuth, requireAdmin, async (req, res) => {
  const { agentId } = req.params;
  
  try {
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return errors.notFound(res, 'Agent not found');
    }
    
    // 检查是否已有 previewVideos
    if (agent.previewVideos && agent.previewVideos.length > 0) {
      return errors.badRequest(res, 'Agent already has previewVideos, migration not needed');
    }
    
    // 从 coverVideoUrls 迁移
    if (!agent.coverVideoUrls || agent.coverVideoUrls.length === 0) {
      return errors.badRequest(res, 'No coverVideoUrls to migrate');
    }
    
    agent.previewVideos = agent.coverVideoUrls.map((url, index) => ({
      url,
      thumbnailUrl: agent.avatarUrls?.[index] || agent.avatarUrls?.[0] || '',
      duration: 0,
      width: 0,
      height: 0,
      fileSize: 0,
      format: 'mp4',
      isVertical: true,
      sortOrder: index,
      tags: [],
      scaleLevel: 1
    }));
    
    await agent.save();
    
    sendSuccess(res, HTTP_STATUS.OK, {
      migratedCount: agent.previewVideos.length,
      videos: agent.previewVideos
    });
    
  } catch (err) {
    console.error('Migrate Preview Videos Error:', err);
    errors.internalError(res, 'Failed to migrate videos');
  }
});

/**
 * POST /api/preview/videos/migrate-all
 * 批量迁移所有主播的 coverVideoUrls（管理员）
 */
router.post('/videos/migrate-all', requireAuth, requireAdmin, async (req, res) => {
  try {
    const agents = await Agent.find({
      coverVideoUrls: { $exists: true, $ne: [] },
      $or: [
        { previewVideos: { $exists: false } },
        { previewVideos: { $size: 0 } }
      ]
    });
    
    let migratedCount = 0;
    
    for (const agent of agents) {
      agent.previewVideos = agent.coverVideoUrls.map((url, index) => ({
        url,
        thumbnailUrl: agent.avatarUrls?.[index] || agent.avatarUrls?.[0] || '',
        duration: 0,
        width: 0,
        height: 0,
        fileSize: 0,
        format: 'mp4',
        isVertical: true,
        sortOrder: index,
        tags: [],
        scaleLevel: 1
      }));
      
      await agent.save();
      migratedCount++;
    }
    
    sendSuccess(res, HTTP_STATUS.OK, {
      migratedAgents: migratedCount
    });
    
  } catch (err) {
    console.error('Migrate All Preview Videos Error:', err);
    errors.internalError(res, 'Failed to migrate all videos');
  }
});

/**
 * GET /api/preview/all
 * 获取所有主播的预览视频（用于首页/列表页）
 */
router.get('/all', async (req, res) => {
  const { maxScale, limit } = req.query;
  
  try {
    const agents = await Agent.find({ status: 'online' })
      .select('name avatarUrls previewVideos coverVideoUrls defaultPreviewIndex')
      .lean();
    
    const result = agents.map(agent => {
      let video = null;
      
      // 优先使用 previewVideos
      if (agent.previewVideos && agent.previewVideos.length > 0) {
        let videos = agent.previewVideos;
        
        // 筛选尺度
        if (maxScale) {
          videos = videos.filter(v => v.scaleLevel <= parseInt(maxScale));
        }
        
        if (videos.length > 0) {
          // 使用默认索引或第一个
          const idx = agent.defaultPreviewIndex < videos.length ? agent.defaultPreviewIndex : 0;
          const v = videos[idx];
          video = {
            url: v.url,
            thumbnailUrl: v.thumbnailUrl || agent.avatarUrls?.[0] || '',
            duration: v.duration,
            isVertical: v.isVertical
          };
        }
      }
      // 兼容 coverVideoUrls
      else if (agent.coverVideoUrls && agent.coverVideoUrls.length > 0) {
        video = {
          url: agent.coverVideoUrls[0],
          thumbnailUrl: agent.avatarUrls?.[0] || '',
          duration: 0,
          isVertical: true
        };
      }
      
      return {
        agentId: agent._id,
        agentName: agent.name,
        avatarUrl: agent.avatarUrls?.[0] || '',
        video
      };
    }).filter(a => a.video !== null);
    
    // 限制数量
    const finalResult = limit ? result.slice(0, parseInt(limit)) : result;
    
    sendSuccess(res, HTTP_STATUS.OK, {
      agents: finalResult,
      totalCount: finalResult.length
    });
    
  } catch (err) {
    console.error('Get All Preview Videos Error:', err);
    errors.internalError(res, 'Failed to get all preview videos');
  }
});

module.exports = router;
