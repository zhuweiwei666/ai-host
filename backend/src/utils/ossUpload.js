const axios = require('axios');
const crypto = require('crypto');

// 动态选择存储客户端
const storageType = process.env.STORAGE_TYPE || 'r2'; // 默认使用 R2

/**
 * 获取存储客户端的上传函数
 */
function getUploader() {
  if (storageType === 'oss' || storageType === 'aliyun') {
    // 使用阿里云 OSS
    const { uploadBufferToOSS } = require('../services/ossClient');
    return async (buffer, objectKey, contentType) => {
      const result = await uploadBufferToOSS(buffer, objectKey, contentType);
      return result.url;
    };
  } else {
    // 默认使用 Cloudflare R2
    const { uploadBufferToR2 } = require('../services/r2Client');
    return async (buffer, objectKey, contentType) => {
      const result = await uploadBufferToR2(buffer, objectKey, contentType);
      return result.url;
    };
  }
}

/**
 * Upload buffer or file to cloud storage (R2 or OSS)
 * @param {Buffer} buffer - File buffer
 * @param {string} fileName - File name (will be prefixed with timestamp and random UUID)
 * @param {string} contentType - MIME type (e.g., 'image/png', 'video/mp4')
 * @returns {Promise<string>} Public URL
 */
async function uploadToOSS(buffer, fileName, contentType = 'image/png') {
  // 验证配置
  if (storageType === 'r2') {
    if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
      throw new Error('R2 credentials not configured. Please set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY');
    }
    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_BUCKET) {
      throw new Error('R2 configuration incomplete. Please set R2_ACCOUNT_ID and R2_BUCKET');
    }
  } else {
    if (!process.env.OSS_ACCESS_KEY_ID || !process.env.OSS_ACCESS_KEY_SECRET) {
      throw new Error('OSS credentials not configured. Please set OSS_ACCESS_KEY_ID and OSS_ACCESS_KEY_SECRET');
    }
    if (!process.env.OSS_BUCKET || !process.env.OSS_REGION || !process.env.OSS_ENDPOINT) {
      throw new Error('OSS configuration incomplete. Please set OSS_BUCKET, OSS_REGION, and OSS_ENDPOINT');
    }
  }

  // 生成唯一文件名
  const timestamp = Date.now();
  const uuid = crypto.randomUUID().substring(0, 8);
  const ext = fileName.split('.').pop() || 'png';
  const uniqueFileName = `${timestamp}-${uuid}.${ext}`;
  
  // 构建对象键，带日期路径
  const basePath = process.env.R2_BASE_PATH || process.env.OSS_BASE_PATH || 'uploads';
  const datePrefix = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const objectKey = `${basePath}/${datePrefix}/${uniqueFileName}`;

  console.log(`[Storage Upload] Type: ${storageType}, Config: bucket=${process.env.R2_BUCKET || process.env.OSS_BUCKET}`);

  try {
    const uploader = getUploader();
    const publicUrl = await uploader(buffer, objectKey, contentType);
    
    console.log(`[Storage Upload] Successfully uploaded ${objectKey} (${buffer.length} bytes) -> ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('[Storage Upload] Failed to upload:', error);
    throw new Error(`Storage upload failed: ${error.message}`);
  }
}

/**
 * Download from URL and upload to cloud storage
 * @param {string} url - Source URL to download
 * @param {string} fileName - Target file name
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} Public URL
 */
async function downloadAndUploadToOSS(url, fileName, contentType = 'image/png') {
  try {
    // Download the file
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);
    
    // Upload to storage
    return await uploadToOSS(buffer, fileName, contentType);
  } catch (error) {
    console.error('[Storage Upload] Failed to download and upload:', error);
    throw new Error(`Download and upload failed: ${error.message}`);
  }
}

module.exports = {
  uploadToOSS,
  downloadAndUploadToOSS,
};
