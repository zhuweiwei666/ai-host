const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

/**
 * Cloudflare R2 存储客户端
 * R2 兼容 S3 API，使用 AWS SDK 连接
 */
let r2Client = null;

/**
 * 获取 R2 客户端实例
 */
function getR2Client() {
  if (!r2Client) {
    // 验证 R2 配置
    if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
      throw new Error('R2 credentials not configured. Please set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY');
    }

    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_BUCKET) {
      throw new Error('R2 configuration incomplete. Please set R2_ACCOUNT_ID and R2_BUCKET');
    }

    // R2 端点格式: https://<account_id>.r2.cloudflarestorage.com
    const endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

    console.log('[R2 Client] Initializing with config:', {
      bucket: process.env.R2_BUCKET,
      accountId: process.env.R2_ACCOUNT_ID,
      endpoint: endpoint,
      accessKeyIdPrefix: process.env.R2_ACCESS_KEY_ID.substring(0, 10) + '...',
    });

    r2Client = new S3Client({
      region: 'auto', // R2 使用 'auto' 区域
      endpoint: endpoint,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return r2Client;
}

/**
 * 获取 R2 公开访问 URL
 * @param {string} objectKey - 对象键
 * @returns {string} 公开访问 URL
 */
function getR2PublicUrl(objectKey) {
  // 如果配置了自定义域名，使用自定义域名
  if (process.env.R2_PUBLIC_URL) {
    let publicUrl = process.env.R2_PUBLIC_URL;
    // 移除末尾斜杠
    publicUrl = publicUrl.replace(/\/$/, '');
    return `${publicUrl}/${objectKey}`;
  }
  
  // 如果开启了 R2 公开访问，使用 r2.dev 域名
  // 格式: https://<bucket>.<account_id>.r2.dev/<object_key>
  // 或者使用自定义域名（推荐）
  if (process.env.R2_DEV_URL) {
    let devUrl = process.env.R2_DEV_URL;
    devUrl = devUrl.replace(/\/$/, '');
    return `${devUrl}/${objectKey}`;
  }

  // 默认返回存储 URL（需要签名才能访问）
  // 建议配置 R2_PUBLIC_URL 或 R2_DEV_URL
  console.warn('[R2 Client] No public URL configured. Please set R2_PUBLIC_URL or enable R2.dev public access.');
  return `https://${process.env.R2_BUCKET}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${objectKey}`;
}

/**
 * 上传 Buffer 到 R2
 * @param {Buffer} buffer - 文件 buffer
 * @param {string} objectKey - R2 对象键 (e.g., 'uploads/2025-12-04/uuid.ext')
 * @param {string} contentType - MIME 类型 (e.g., 'image/png', 'video/mp4')
 * @returns {Promise<{url: string, key: string}>}
 */
async function uploadBufferToR2(buffer, objectKey, contentType) {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET;

  console.log(`[R2 Client] Uploading: ${objectKey} (${buffer.length} bytes, type: ${contentType || 'unknown'})`);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    Body: buffer,
    ContentType: contentType || 'application/octet-stream',
  });

  try {
    const result = await client.send(command);
    const publicUrl = getR2PublicUrl(objectKey);
    
    console.log(`[R2 Client] Upload successful: ${publicUrl}`);
    
    return {
      url: publicUrl,
      key: objectKey,
      etag: result.ETag,
    };
  } catch (error) {
    console.error('[R2 Client] Upload failed:', {
      message: error.message,
      code: error.Code,
      requestId: error.$metadata?.requestId,
      objectKey,
      bufferSize: buffer.length,
      contentType,
    });
    throw error;
  }
}

module.exports = {
  getR2Client,
  uploadBufferToR2,
  getR2PublicUrl,
};

