const OSS = require('ali-oss');
const axios = require('axios');
const crypto = require('crypto');

/**
 * Upload buffer or file to OSS
 * @param {Buffer} buffer - File buffer
 * @param {string} fileName - File name (will be prefixed with timestamp and random UUID)
 * @param {string} contentType - MIME type (e.g., 'image/png', 'video/mp4')
 * @returns {Promise<string>} Public OSS URL
 */
async function uploadToOSS(buffer, fileName, contentType = 'image/png') {
  // Validate OSS configuration
  if (!process.env.OSS_ACCESS_KEY_ID || !process.env.OSS_ACCESS_KEY_SECRET) {
    throw new Error('OSS credentials not configured. Please set OSS_ACCESS_KEY_ID and OSS_ACCESS_KEY_SECRET');
  }

  if (!process.env.OSS_BUCKET || !process.env.OSS_REGION || !process.env.OSS_ENDPOINT) {
    throw new Error('OSS configuration incomplete. Please set OSS_BUCKET, OSS_REGION, and OSS_ENDPOINT');
  }

  // Generate unique file name
  const timestamp = Date.now();
  const uuid = crypto.randomUUID().substring(0, 8);
  const ext = fileName.split('.').pop() || 'png';
  const uniqueFileName = `${timestamp}-${uuid}.${ext}`;
  
  // Build object key with base path
  const basePath = process.env.OSS_BASE_PATH || 'uploads';
  const objectKey = `${basePath}/${uniqueFileName}`;

  // Create OSS client
  const client = new OSS({
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET,
    region: process.env.OSS_REGION,
    endpoint: process.env.OSS_ENDPOINT,
  });

  try {
    // Upload to OSS
    const result = await client.put(objectKey, buffer, {
      headers: {
        'Content-Type': contentType,
      },
    });

    // Ensure URL is HTTPS and absolute
    let publicUrl = result.url;
    if (!publicUrl.startsWith('http://') && !publicUrl.startsWith('https://')) {
      const protocol = process.env.OSS_ENDPOINT.includes('https') ? 'https' : 'http';
      publicUrl = `${protocol}://${process.env.OSS_BUCKET}.${process.env.OSS_ENDPOINT}/${objectKey}`;
    }
    
    // Force HTTPS
    if (publicUrl.startsWith('http://')) {
      publicUrl = publicUrl.replace('http://', 'https://');
    }

    console.log(`[OSS Upload] Successfully uploaded ${objectKey} (${buffer.length} bytes) -> ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('[OSS Upload] Failed to upload:', error);
    throw new Error(`OSS upload failed: ${error.message}`);
  }
}

/**
 * Download from URL and upload to OSS
 * @param {string} url - Source URL to download
 * @param {string} fileName - Target file name
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} Public OSS URL
 */
async function downloadAndUploadToOSS(url, fileName, contentType = 'image/png') {
  try {
    // Download the file
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);
    
    // Upload to OSS
    return await uploadToOSS(buffer, fileName, contentType);
  } catch (error) {
    console.error('[OSS Upload] Failed to download and upload:', error);
    throw new Error(`Download and upload failed: ${error.message}`);
  }
}

module.exports = {
  uploadToOSS,
  downloadAndUploadToOSS,
};

