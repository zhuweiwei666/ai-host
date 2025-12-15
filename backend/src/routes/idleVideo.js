/**
 * IDLE 视频处理 API
 * 
 * - POST /api/idle-video/process/:agentId - 上传并处理 IDLE 视频
 * - GET /api/idle-video/status/:agentId - 获取处理状态
 * - GET /api/idle-video/check - 检查系统依赖
 */

const express = require('express');
const multer = require('multer');
const router = express.Router();
const Agent = require('../models/Agent');
const { sendSuccess, errors, HTTP_STATUS } = require('../utils/errorHandler');
const { requireAuth } = require('../middleware/auth');
const { processIdleVideo, checkDependencies, getVideoInfo } = require('../services/idleVideoProcessor');

// 管理员检查中间件
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return errors.forbidden(res, 'Admin access required');
  }
  next();
};

// 配置 multer（内存存储，500MB 限制）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  },
});

// 获取上传函数
function getUploader() {
  const storageType = process.env.STORAGE_TYPE || 'r2';
  if (storageType === 'oss' || storageType === 'aliyun') {
    const { uploadBufferToOSS } = require('../services/ossClient');
    return uploadBufferToOSS;
  } else {
    const { uploadBufferToR2 } = require('../services/r2Client');
    return uploadBufferToR2;
  }
}

/**
 * GET /api/idle-video/check
 * 检查系统依赖（ffmpeg, vidstab）
 */
router.get('/check', requireAuth, requireAdmin, async (req, res) => {
  try {
    const deps = await checkDependencies();
    
    sendSuccess(res, HTTP_STATUS.OK, {
      ready: deps.ffmpeg,
      dependencies: deps,
      warnings: !deps.vidstab ? ['vidstab not available, video stabilization will be skipped'] : [],
    });
  } catch (error) {
    console.error('[IdleVideo] Check dependencies error:', error);
    errors.serverError(res, 'Failed to check dependencies');
  }
});

/**
 * POST /api/idle-video/process/:agentId
 * 上传并处理 IDLE 视频
 * 
 * 处理流程：
 * 1. 接收视频文件
 * 2. 规范化（1080x1920/30fps/H.264）
 * 3. 稳定化（vidstab）
 * 4. 生成 reverse
 * 5. 拼接 ping-pong loop
 * 6. 切点检测
 * 7. 质量验收
 * 8. 上传到存储
 * 9. 更新 Agent 的 previewVideos
 */
router.post('/process/:agentId', requireAuth, requireAdmin, upload.single('video'), async (req, res) => {
  const { agentId } = req.params;
  const file = req.file;
  
  if (!file) {
    return errors.badRequest(res, 'Video file is required');
  }
  
  console.log(`[IdleVideo] Processing IDLE video for agent ${agentId}, file: ${file.originalname}, size: ${file.size}`);
  
  try {
    // 验证 Agent 存在
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return errors.notFound(res, 'Agent not found');
    }
    
    // 获取上传函数
    const uploadFn = getUploader();
    
    // 处理视频
    const result = await processIdleVideo(file.buffer, file.originalname, uploadFn);
    
    if (!result.success) {
      return errors.badRequest(res, 'Video processing failed', {
        qc: result.qc,
      });
    }
    
    // 如果 QC 未通过，返回警告但继续
    if (!result.qc.passed) {
      console.warn('[IdleVideo] QC issues:', result.qc.issues);
    }
    
    // 创建 previewVideo 条目
    const idleVideoEntry = {
      url: result.urls.forward,
      loopSafeUrl: result.urls.loopSafe,
      thumbnailUrl: '', // 可以后续生成
      duration: result.metadata.duration,
      width: result.metadata.width,
      height: result.metadata.height,
      format: 'mp4',
      isVertical: result.metadata.height > result.metadata.width,
      sortOrder: 0, // IDLE 视频放在最前面
      tags: ['idle', 'loopable'],
      assetType: 'idle',
      loopSafe: true,
      safeCutPoints: result.metadata.safeCutPoints,
      poseId: 'neutral',
    };
    
    // 检查是否已有 IDLE 视频，替换或添加
    const existingIdleIndex = agent.previewVideos.findIndex(v => v.assetType === 'idle' && v.loopSafe);
    
    if (existingIdleIndex >= 0) {
      // 替换现有的 IDLE 视频
      agent.previewVideos[existingIdleIndex] = {
        ...agent.previewVideos[existingIdleIndex].toObject(),
        ...idleVideoEntry,
      };
    } else {
      // 添加新的 IDLE 视频到开头
      agent.previewVideos.unshift(idleVideoEntry);
    }
    
    // 更新 LiveSkin 状态
    agent.liveSkinStatus = 'ready';
    
    await agent.save();
    
    // 获取保存后的视频 ID
    const savedVideo = agent.previewVideos.find(v => v.url === result.urls.forward);
    
    sendSuccess(res, HTTP_STATUS.OK, {
      message: 'IDLE video processed and saved successfully',
      videoId: savedVideo?._id,
      urls: result.urls,
      metadata: result.metadata,
      qc: result.qc,
    });
  } catch (error) {
    console.error('[IdleVideo] Processing error:', error);
    errors.serverError(res, `Video processing failed: ${error.message}`);
  }
});

/**
 * GET /api/idle-video/status/:agentId
 * 获取 Agent 的 IDLE 视频状态
 */
router.get('/status/:agentId', requireAuth, async (req, res) => {
  const { agentId } = req.params;
  
  try {
    const agent = await Agent.findById(agentId).select('previewVideos liveSkinStatus');
    
    if (!agent) {
      return errors.notFound(res, 'Agent not found');
    }
    
    // 查找 IDLE 视频
    const idleVideos = agent.previewVideos.filter(v => v.assetType === 'idle');
    const loopSafeIdle = idleVideos.find(v => v.loopSafe);
    
    sendSuccess(res, HTTP_STATUS.OK, {
      agentId,
      liveSkinStatus: agent.liveSkinStatus || 'pending',
      hasIdleVideo: idleVideos.length > 0,
      hasLoopSafe: !!loopSafeIdle,
      idleVideo: loopSafeIdle ? {
        id: loopSafeIdle._id,
        url: loopSafeIdle.url,
        loopSafeUrl: loopSafeIdle.loopSafeUrl,
        duration: loopSafeIdle.duration,
        safeCutPoints: loopSafeIdle.safeCutPoints,
      } : null,
      totalIdleVideos: idleVideos.length,
    });
  } catch (error) {
    console.error('[IdleVideo] Status error:', error);
    errors.serverError(res, 'Failed to get status');
  }
});

/**
 * DELETE /api/idle-video/:agentId/:videoId
 * 删除 IDLE 视频
 */
router.delete('/:agentId/:videoId', requireAuth, requireAdmin, async (req, res) => {
  const { agentId, videoId } = req.params;
  
  try {
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return errors.notFound(res, 'Agent not found');
    }
    
    const video = agent.previewVideos.id(videoId);
    if (!video) {
      return errors.notFound(res, 'Video not found');
    }
    
    // 移除视频
    agent.previewVideos.pull(videoId);
    
    // 检查是否还有 IDLE 视频
    const remainingIdle = agent.previewVideos.find(v => v.assetType === 'idle' && v.loopSafe);
    if (!remainingIdle) {
      agent.liveSkinStatus = 'pending';
    }
    
    await agent.save();
    
    sendSuccess(res, HTTP_STATUS.OK, {
      message: 'IDLE video deleted',
      remainingIdleVideos: agent.previewVideos.filter(v => v.assetType === 'idle').length,
    });
  } catch (error) {
    console.error('[IdleVideo] Delete error:', error);
    errors.serverError(res, 'Failed to delete video');
  }
});

module.exports = router;
