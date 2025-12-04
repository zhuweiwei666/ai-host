/**
 * Configure OSS CORS rules programmatically using ali-oss SDK.
 *
 * Usage:
 *   node deploy/set_oss_cors.js
 *
 * Requirements:
 *   - backend/.env 中已配置 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_BUCKET / OSS_REGION / OSS_ENDPOINT
 *   - 已在项目根目录执行（能够读取 backend/.env）
 */

const path = require('path');
const fs = require('fs');
const OSS = require('ali-oss');
const dotenv = require('dotenv');

// Load backend environment variables so we reuse the same OSS credentials
const envPath = path.join(__dirname, '../backend/.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ backend/.env 不存在，无法读取 OSS 配置');
  process.exit(1);
}
dotenv.config({ path: envPath });

const {
  OSS_ACCESS_KEY_ID,
  OSS_ACCESS_KEY_SECRET,
  OSS_BUCKET,
  OSS_REGION,
  OSS_ENDPOINT,
} = process.env;

if (!OSS_ACCESS_KEY_ID || !OSS_ACCESS_KEY_SECRET || !OSS_BUCKET || !OSS_REGION || !OSS_ENDPOINT) {
  console.error('❌ OSS 环境变量不完整，请检查 backend/.env');
  process.exit(1);
}

const endpoint = OSS_ENDPOINT.replace(/^https?:\/\//, '');

const client = new OSS({
  region: OSS_REGION,
  accessKeyId: OSS_ACCESS_KEY_ID,
  accessKeySecret: OSS_ACCESS_KEY_SECRET,
  endpoint,
});

const allowedOrigins = [
  'https://cling-ai.com',
  'https://www.cling-ai.com',
  'http://localhost:5173',
  'http://localhost:3000',
];

const corsRules = [{
  allowedOrigin: allowedOrigins,
  // OSS 预检本身使用 OPTIONS，这里只需要列出真实业务动词
  allowedMethod: ['GET', 'PUT', 'POST', 'HEAD', 'DELETE'],
  allowedHeader: ['*'],
  exposeHeader: ['ETag', 'x-oss-request-id', 'x-oss-next-append-position'],
  maxAgeSeconds: 3600,
}];

(async () => {
  try {
    console.log('==========================================');
    console.log('  Setting OSS CORS configuration via SDK');
    console.log('==========================================');
    console.log('Bucket  :', OSS_BUCKET);
    console.log('Region  :', OSS_REGION);
    console.log('Endpoint:', endpoint);
    console.log('Origins :', allowedOrigins.join(', '));
    console.log('');

    await client.putBucketCORS(OSS_BUCKET, corsRules);

    console.log('✅ CORS configuration updated successfully.');
    console.log('请等待 1-2 分钟让配置在全球节点生效。');
    console.log('==========================================');
  } catch (err) {
    console.error('❌ Failed to set CORS configuration:', err);
    process.exit(1);
  }
})();

