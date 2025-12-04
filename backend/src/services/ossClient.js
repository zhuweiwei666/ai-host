const OSS = require('ali-oss');

/**
 * Reusable OSS client service
 * Uses environment variables for configuration
 */
let ossClient = null;

function getOSSClient() {
  if (!ossClient) {
    // Validate OSS configuration
    if (!process.env.OSS_ACCESS_KEY_ID || !process.env.OSS_ACCESS_KEY_SECRET) {
      throw new Error('OSS credentials not configured. Please set OSS_ACCESS_KEY_ID and OSS_ACCESS_KEY_SECRET');
    }

    if (!process.env.OSS_BUCKET || !process.env.OSS_REGION) {
      throw new Error('OSS configuration incomplete. Please set OSS_BUCKET and OSS_REGION');
    }

    // Log configuration for debugging (mask sensitive values)
    console.log('[OSS Client] Initializing with config:', {
      bucket: process.env.OSS_BUCKET,
      region: process.env.OSS_REGION,
      endpoint: process.env.OSS_ENDPOINT || 'not set',
      accessKeyIdPrefix: process.env.OSS_ACCESS_KEY_ID ? process.env.OSS_ACCESS_KEY_ID.substring(0, 10) + '...' : 'not set',
    });

    // Create OSS client configuration
    // Use region from env directly (e.g., oss-ap-southeast-1)
    // Do NOT remove 'oss-' prefix for backend ali-oss SDK
    const clientConfig = {
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET,
      region: process.env.OSS_REGION,
      secure: true, // Force HTTPS
    };

    // If endpoint is provided, use it (some regions may require explicit endpoint)
    if (process.env.OSS_ENDPOINT) {
      let endpoint = process.env.OSS_ENDPOINT;
      // Remove protocol if present
      endpoint = endpoint.replace(/^https?:\/\//, '');
      // Remove trailing slash if present
      endpoint = endpoint.replace(/\/$/, '');
      clientConfig.endpoint = endpoint;
      console.log('[OSS Client] Using explicit endpoint:', endpoint);
    }

    ossClient = new OSS(clientConfig);
  }
  return ossClient;
}

/**
 * Upload buffer to OSS
 * @param {Buffer} buffer - File buffer
 * @param {string} objectKey - OSS object key (e.g., 'uploads/2025-12-03/uuid.ext')
 * @param {string} contentType - MIME type (e.g., 'image/png', 'video/mp4')
 * @returns {Promise<{url: string, name: string, res: any}>}
 */
async function uploadBufferToOSS(buffer, objectKey, contentType) {
  const client = getOSSClient();
  
  const options = {};
  if (contentType) {
    options.headers = {
      'Content-Type': contentType,
    };
  }

  console.log(`[OSS Client] Uploading: ${objectKey} (${buffer.length} bytes, type: ${contentType || 'unknown'})`);

  let result;
  try {
    result = await client.put(objectKey, buffer, options);
    console.log(`[OSS Client] Upload successful: ${result.url || result.name}`);
  } catch (error) {
    console.error('[OSS Client] Upload failed:', {
      message: error.message,
      code: error.code,
      status: error.status,
      requestId: error.requestId,
      objectKey,
      bufferSize: buffer.length,
      contentType,
    });
    throw error;
  }

  // Ensure URL is HTTPS and absolute
  let publicUrl = result.url;
  
  // If result.url is not a full URL, construct it manually
  if (!publicUrl || (!publicUrl.startsWith('http://') && !publicUrl.startsWith('https://'))) {
    // Construct OSS public URL
    // Format: https://bucket-name.endpoint/object-key
    let endpoint = process.env.OSS_ENDPOINT || '';
    // Remove protocol if present
    endpoint = endpoint.replace(/^https?:\/\//, '');
    // Remove trailing slash if present
    endpoint = endpoint.replace(/\/$/, '');
    
    const bucket = process.env.OSS_BUCKET;
    publicUrl = `https://${bucket}.${endpoint}/${objectKey}`;
    
    console.log(`[OSS Client] Constructed URL manually: ${publicUrl}`);
  }
  
  // Force HTTPS
  if (publicUrl.startsWith('http://')) {
    publicUrl = publicUrl.replace('http://', 'https://');
  }

  return {
    url: publicUrl,
    name: result.name,
    res: result,
  };
}

module.exports = {
  getOSSClient,
  uploadBufferToOSS,
};

