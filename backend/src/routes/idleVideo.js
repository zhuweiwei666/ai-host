/**
 * IDLE 视频上传 API（简化版）
 * 
 * 运营人员手动剪辑好可循环的 IDLE 视频后上传
 * 客户端直接 loop 播放
 * 
 * - POST /api/idle-video/upload/:agentId - 上传 IDLE 视频
 * - GET /api/idle-video/status/:agentId - 获取 IDLE 视频状态
 * - DELETE /api/idle-video/:agentId/:videoId - 删除 IDLE 视频
 */

const express = require('express');
const multer = require('multer');
const router = express.Router();
const Agent = require('../models/Agent');
const { sendSuccess, errors, HTTP_STATUS } = require('../utils/errorHandler');
const { requireAuth } = require('../middleware/auth');

// 管理员检查中间件
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return errors.forbidden(res, 'Admin access required');
  }
  next();
};

// 配置 multer（内存存储，100MB 限制）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
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
 * POST /api/idle-video/upload/:agentId
 * 上传 IDLE 视频（简化版，无 FFmpeg 处理）
 * 
 * 运营人员需要手动剪辑好可无缝循环的视频
 * 建议规格：1080x1920 / 3-5秒 / 首尾帧一致
 */
router.post('/upload/:agentId', requireAuth, requireAdmin, upload.single('video'), async (req, res) => {
  const { agentId } = req.params;
  const file = req.file;
  
  if (!file) {
    return errors.badRequest(res, 'Video file is required');
  }
  
  console.log(`[IdleVideo] Uploading IDLE video for agent ${agentId}, file: ${file.originalname}, size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
  
  try {
    // 验证 Agent 存在
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return errors.notFound(res, 'Agent not found');
    }
    
    // 获取上传函数
    const uploadFn = getUploader();
    
    // 生成文件名
    const timestamp = Date.now();
    const ext = file.originalname.split('.').pop() || 'mp4';
    const filename = `idle/${agentId}/idle_${timestamp}.${ext}`;
    
    // 上传视频
    console.log(`[IdleVideo] Uploading to storage: ${filename}`);
    const uploadResult = await uploadFn(file.buffer, filename, file.mimetype);
    // uploadFn 可能返回字符串 URL 或对象 { url, key, name }
    const videoUrl = typeof uploadResult === 'string' ? uploadResult : uploadResult.url;
    console.log(`[IdleVideo] Upload complete: ${videoUrl}`);
    
    // 创建 previewVideo 条目
    const idleVideoEntry = {
      url: videoUrl,
      loopSafeUrl: videoUrl, // 手动剪辑的视频本身就是可循环的
      thumbnailUrl: '',
      duration: 0, // 客户端可以获取
      width: 1080,
      height: 1920,
      format: 'mp4',
      isVertical: true,
      sortOrder: 0, // IDLE 视频放在最前面
      tags: ['idle', 'loopable'],
      assetType: 'idle',
      loopSafe: true,
      safeCutPoints: [0], // 整个视频任意位置都可以切
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
      console.log(`[IdleVideo] Replaced existing IDLE video at index ${existingIdleIndex}`);
    } else {
      // 添加新的 IDLE 视频到开头
      agent.previewVideos.unshift(idleVideoEntry);
      console.log(`[IdleVideo] Added new IDLE video`);
    }
    
    // 更新 LiveSkin 状态
    agent.liveSkinStatus = 'ready';
    
    await agent.save();
    
    // 获取保存后的视频 ID
    const savedVideo = agent.previewVideos.find(v => v.url === videoUrl);
    
    sendSuccess(res, HTTP_STATUS.OK, {
      message: 'IDLE video uploaded successfully',
      videoId: savedVideo?._id,
      url: videoUrl,
      tips: [
        '✅ 视频已上传，客户端将循环播放',
        '💡 建议：确保视频首尾帧一致，以实现无缝循环',
        '📐 推荐规格：1080x1920 / 3-5秒 / H.264',
      ],
    });
  } catch (error) {
    console.error('[IdleVideo] Upload error:', error);
    return errors.internalError(res, `Video upload failed: ${error.message}`);
  }
});

// 兼容旧的 /process 路由，重定向到 /upload
router.post('/process/:agentId', requireAuth, requireAdmin, upload.single('video'), async (req, res) => {
  console.log(`[IdleVideo] Redirecting /process to /upload for agent ${req.params.agentId}`);
  // 内部转发到 upload 逻辑
  req.url = `/upload/${req.params.agentId}`;
  return router.handle(req, res);
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
    errors.internalError(res, 'Failed to get status');
  }
});

/**
 * GET /api/idle-video/check
 * 检查系统状态（简化版，无需 FFmpeg）
 */
router.get('/check', requireAuth, requireAdmin, async (req, res) => {
  sendSuccess(res, HTTP_STATUS.OK, {
    ready: true,
    mode: 'direct-upload',
    message: '直传模式：前端直接上传到 R2，绕过 Cloudflare 超时限制',
    requirements: [
      '视频首尾帧一致（无缝循环）',
      '推荐规格：1080x1920 / 3-5秒',
      '格式：MP4 / H.264',
    ],
  });
});

/**
 * POST /api/idle-video/presign/:agentId
 * 获取预签名上传 URL（前端直传 R2）
 * 
 * Body: { filename: string, contentType: string }
 * Returns: { uploadUrl, publicUrl, key }
 */
router.post('/presign/:agentId', requireAuth, requireAdmin, async (req, res) => {
  const { agentId } = req.params;
  const { filename, contentType } = req.body;

  if (!filename) {
    return errors.badRequest(res, 'filename is required');
  }

  try {
    // 验证 Agent 存在
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return errors.notFound(res, 'Agent not found');
    }

    // 生成唯一的对象键
    const timestamp = Date.now();
    const ext = filename.split('.').pop() || 'mp4';
    const objectKey = `idle/${agentId}/idle_${timestamp}.${ext}`;

    // 获取预签名 URL
    const { getPresignedUploadUrl } = require('../services/r2Client');
    const result = await getPresignedUploadUrl(objectKey, contentType || 'video/mp4', 600);

    console.log(`[IdleVideo] Generated presigned URL for agent ${agentId}: ${objectKey}`);

    sendSuccess(res, HTTP_STATUS.OK, {
      uploadUrl: result.uploadUrl,
      publicUrl: result.publicUrl,
      key: result.key,
      expiresIn: 600,
    });
  } catch (error) {
    console.error('[IdleVideo] Presign error:', error);
    errors.internalError(res, `Failed to generate upload URL: ${error.message}`);
  }
});

/**
 * POST /api/idle-video/register/:agentId
 * 注册已上传的 IDLE 视频（前端直传完成后调用）
 * 
 * Body: { url: string, key: string }
 */
router.post('/register/:agentId', requireAuth, requireAdmin, async (req, res) => {
  const { agentId } = req.params;
  const { url, key } = req.body;

  if (!url) {
    return errors.badRequest(res, 'url is required');
  }

  console.log(`[IdleVideo] Registering IDLE video for agent ${agentId}: ${url}`);

  try {
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return errors.notFound(res, 'Agent not found');
    }

    // 创建 previewVideo 条目
    const idleVideoEntry = {
      url: url,
      loopSafeUrl: url,
      thumbnailUrl: '',
      duration: 0,
      width: 1080,
      height: 1920,
      format: 'mp4',
      isVertical: true,
      sortOrder: 0,
      tags: ['idle', 'loopable'],
      assetType: 'idle',
      loopSafe: true,
      safeCutPoints: [0],
      poseId: 'neutral',
    };

    // 检查是否已有 IDLE 视频，替换或添加
    const existingIdleIndex = agent.previewVideos.findIndex(v => v.assetType === 'idle' && v.loopSafe);

    if (existingIdleIndex >= 0) {
      agent.previewVideos[existingIdleIndex] = {
        ...agent.previewVideos[existingIdleIndex].toObject(),
        ...idleVideoEntry,
      };
      console.log(`[IdleVideo] Replaced existing IDLE video at index ${existingIdleIndex}`);
    } else {
      agent.previewVideos.unshift(idleVideoEntry);
      console.log(`[IdleVideo] Added new IDLE video`);
    }

    agent.liveSkinStatus = 'ready';
    await agent.save();

    const savedVideo = agent.previewVideos.find(v => v.url === url);

    sendSuccess(res, HTTP_STATUS.OK, {
      message: 'IDLE video registered successfully',
      videoId: savedVideo?._id,
      url: url,
      tips: [
        '✅ 视频已上传，客户端将循环播放',
        '💡 建议：确保视频首尾帧一致，以实现无缝循环',
        '📐 推荐规格：1080x1920 / 3-5秒 / H.264',
      ],
    });
  } catch (error) {
    console.error('[IdleVideo] Register error:', error);
    errors.internalError(res, `Failed to register video: ${error.message}`);
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
    errors.internalError(res, 'Failed to delete video');
  }
});

module.exports = router;
