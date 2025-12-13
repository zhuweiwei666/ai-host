const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { errors, sendSuccess, HTTP_STATUS } = require('../utils/errorHandler');
const axios = require('axios');

const router = express.Router();

// 获取存储类型
const storageType = process.env.STORAGE_TYPE || 'r2'; // 默认使用 R2

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max file size
  },
});

/**
 * 获取存储客户端的上传函数
 */
function getUploader() {
  if (storageType === 'oss' || storageType === 'aliyun') {
    const { uploadBufferToOSS } = require('../services/ossClient');
    return uploadBufferToOSS;
  } else {
    const { uploadBufferToR2 } = require('../services/r2Client');
    return uploadBufferToR2;
  }
}

// GET /api/oss/config - 获取存储配置信息（用于前端显示）
router.get('/config', optionalAuth, async (req, res) => {
  try {
    if (storageType === 'r2') {
      // R2 配置
      if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
        return errors.ossError(res, 'R2 服务未配置。请配置 R2_ACCESS_KEY_ID 和 R2_SECRET_ACCESS_KEY', { 
          error: 'R2 credentials not configured'
        });
      }
      
      sendSuccess(res, HTTP_STATUS.OK, {
        type: 'r2',
        bucket: process.env.R2_BUCKET,
        basePath: process.env.R2_BASE_PATH || 'uploads',
        publicUrl: process.env.R2_PUBLIC_URL || process.env.R2_DEV_URL || null,
      });
    } else {
      // OSS 配置
      if (!process.env.OSS_ACCESS_KEY_ID || !process.env.OSS_ACCESS_KEY_SECRET) {
        return errors.ossError(res, 'OSS 服务未配置', { 
          error: 'OSS credentials not configured'
        });
      }
      
      sendSuccess(res, HTTP_STATUS.OK, {
        type: 'oss',
        bucket: process.env.OSS_BUCKET,
        region: process.env.OSS_REGION,
        endpoint: process.env.OSS_ENDPOINT,
        basePath: process.env.OSS_BASE_PATH || 'uploads',
      });
    }
  } catch (err) {
    console.error('[Storage Config] Error:', err);
    errors.ossError(res, err.message);
  }
});

// GET /api/oss/sts - 保留 STS 端点以兼容旧代码
// 注意: R2 不支持 STS，前端应使用 /upload 端点
router.get('/sts', optionalAuth, async (req, res) => {
  try {
    if (storageType === 'r2') {
      // R2 不支持 STS，返回提示使用上传 API
      return errors.badRequest(res, 'R2 存储不支持 STS 临时凭证。请使用 POST /api/oss/upload 进行文件上传', {
        error: 'STS not supported for R2',
        hint: '请使用后端代理上传 API: POST /api/oss/upload',
        storageType: 'r2'
      });
    }

    // 原有 OSS STS 逻辑
    const { STS } = require('ali-oss');
    
    const userId = req.user?.id || 'anonymous';
    console.log(`[OSS STS] Request from user: ${userId}`);
    
    if (!process.env.OSS_ACCESS_KEY_ID || !process.env.OSS_ACCESS_KEY_SECRET) {
      return errors.ossError(res, 'OSS 服务未配置', { 
        error: 'OSS credentials not configured'
      });
    }
    
    if (!process.env.OSS_BUCKET || !process.env.OSS_REGION || !process.env.OSS_ENDPOINT) {
      return errors.ossError(res, 'OSS 配置不完整', { 
        error: 'OSS configuration incomplete'
      });
    }

    const STSClient = new STS({
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    });

    const roleArn = process.env.OSS_ROLE_ARN;
    const isRootAccount = !roleArn || roleArn.includes('123456789') || roleArn.includes('placeholder');
    
    if (isRootAccount) {
      sendSuccess(res, HTTP_STATUS.OK, {
        accessKeyId: process.env.OSS_ACCESS_KEY_ID,
        accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
        securityToken: '',
        expiration: new Date(Date.now() + 3600000).toISOString(),
        bucket: process.env.OSS_BUCKET,
        region: process.env.OSS_REGION,
        endpoint: process.env.OSS_ENDPOINT,
        basePath: process.env.OSS_BASE_PATH || 'uploads',
      });
    } else {
      const policy = {
        Version: "1",
        Statement: [
          {
            Action: ["oss:PutObject"],
            Effect: "Allow",
            Resource: `acs:oss:*:*:${process.env.OSS_BUCKET}/${process.env.OSS_BASE_PATH || 'uploads'}/*`,
          },
        ],
      };

      const result = await STSClient.assumeRole(roleArn, policy, 3600);

      sendSuccess(res, HTTP_STATUS.OK, {
        accessKeyId: result.credentials.AccessKeyId,
        accessKeySecret: result.credentials.AccessKeySecret,
        securityToken: result.credentials.SecurityToken,
        expiration: result.credentials.Expiration,
        bucket: process.env.OSS_BUCKET || '',
        region: process.env.OSS_REGION || '',
        endpoint: process.env.OSS_ENDPOINT || '',
        basePath: process.env.OSS_BASE_PATH || 'uploads',
      });
    }
  } catch (err) {
    console.error('[OSS STS] Error:', err);
    errors.ossError(res, err.message);
  }
});

// POST /api/oss/upload - 文件上传（支持 R2 和 OSS）
router.post('/upload', optionalAuth, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const folder = req.query.folder || process.env.R2_BASE_PATH || process.env.OSS_BASE_PATH || 'uploads';

    if (!file) {
      return errors.badRequest(res, 'file is required', {
        error: 'Missing file',
        hint: 'Please provide a file in the request body with field name "file"'
      });
    }

    // 生成唯一 objectKey: folder/YYYY-MM-DD/uuid.ext
    const ext = file.originalname.includes('.')
      ? file.originalname.substring(file.originalname.lastIndexOf('.'))
      : '';
    const datePrefix = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const objectKey = `${folder}/${datePrefix}/${uuidv4()}${ext}`;

    console.log(`[Storage Upload API] Type: ${storageType}, File: ${file.originalname} (${file.size} bytes) -> ${objectKey}`);

    // 获取对应的上传函数并上传
    const uploader = getUploader();
    const result = await uploader(
      file.buffer,
      objectKey,
      file.mimetype || 'application/octet-stream'
    );

    console.log(`[Storage Upload API] Success: ${objectKey} -> ${result.url}`);

    return sendSuccess(res, HTTP_STATUS.OK, {
      url: result.url,
      key: objectKey,
      name: result.name || objectKey,
      storageType: storageType,
    });
  } catch (err) {
    console.error('[Storage Upload API] Error:', err);
    const isDev = process.env.NODE_ENV === 'development';
    const errorMessage = err?.message || 'Storage upload failed';
    
    return errors.ossError(res, errorMessage, {
      error: errorMessage,
      stack: isDev ? err?.stack : undefined
    });
  }
});

// GET /api/oss/proxy?url=https://...
// WHY: fix browser CORS issues when loading R2/OSS assets from WebGL (meta + textures).
router.get('/proxy', optionalAuth, async (req, res) => {
  try {
    const rawUrl = String(req.query.url || '');
    if (!rawUrl) return errors.badRequest(res, 'url is required');

    let u;
    try {
      u = new URL(rawUrl);
    } catch {
      return errors.badRequest(res, 'invalid url');
    }

    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      return errors.badRequest(res, 'unsupported protocol');
    }

    const host = (u.hostname || '').toLowerCase();
    if (!host) return errors.badRequest(res, 'invalid host');

    // Basic SSRF protection: block localhost-ish hosts.
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local')
    ) {
      return errors.badRequest(res, 'blocked host');
    }

    // Allowlist common storage hosts + env-configured public domains.
    const allowHosts = new Set();
    const addHostFromEnvUrl = (envUrl) => {
      if (!envUrl) return;
      try {
        const uu = new URL(String(envUrl).startsWith('http') ? String(envUrl) : `https://${envUrl}`);
        if (uu.hostname) allowHosts.add(uu.hostname.toLowerCase());
      } catch {
        // ignore
      }
    };
    addHostFromEnvUrl(process.env.R2_PUBLIC_URL);
    addHostFromEnvUrl(process.env.R2_DEV_URL);

    const ossEndpoint = (process.env.OSS_ENDPOINT || '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    const ossBucket = (process.env.OSS_BUCKET || '').toLowerCase();
    if (ossEndpoint) allowHosts.add(ossEndpoint);
    if (ossEndpoint && ossBucket) allowHosts.add(`${ossBucket}.${ossEndpoint}`);

    // Also allow known storage suffixes used by this app.
    const allowedBySuffix =
      host.endsWith('.r2.dev') ||
      host.endsWith('.r2.cloudflarestorage.com') ||
      host.endsWith('.aliyuncs.com');

    const allowed = allowedBySuffix || allowHosts.has(host);
    if (!allowed) return errors.badRequest(res, `host not allowed: ${host}`);

    const upstream = await axios.get(rawUrl, {
      responseType: 'arraybuffer',
      timeout: 30_000,
      maxContentLength: 12 * 1024 * 1024,
      maxBodyLength: 12 * 1024 * 1024,
      headers: {
        // Avoid sending any user credentials/cookies to upstream.
        'User-Agent': 'ai-host-proxy',
      },
      validateStatus: () => true,
    });

    if (upstream.status < 200 || upstream.status >= 300) {
      return errors.badRequest(res, `upstream error: ${upstream.status}`, {
        status: upstream.status,
        contentType: upstream.headers?.['content-type'],
      });
    }

    const ct = upstream.headers?.['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(Buffer.from(upstream.data));
  } catch (err) {
    console.error('[GET /api/oss/proxy] Error:', err);
    return errors.badRequest(res, err?.message || 'proxy failed');
  }
});

module.exports = router;
