/**
 * Helper script to configure OSS CORS from inside the backend container.
 * Usage inside container:
 *    node scripts/setOssCors.js
 */

const OSS = require('ali-oss');

const {
  OSS_ACCESS_KEY_ID,
  OSS_ACCESS_KEY_SECRET,
  OSS_BUCKET,
  OSS_REGION,
  OSS_ENDPOINT,
} = process.env;

if (!OSS_ACCESS_KEY_ID || !OSS_ACCESS_KEY_SECRET || !OSS_BUCKET || !OSS_REGION || !OSS_ENDPOINT) {
  console.error('❌ Missing OSS environment variables');
  process.exit(1);
}

const endpoint = OSS_ENDPOINT.replace(/^https?:\/\//, '');

const client = new OSS({
  region: OSS_REGION,
  accessKeyId: OSS_ACCESS_KEY_ID,
  accessKeySecret: OSS_ACCESS_KEY_SECRET,
  endpoint,
  bucket: OSS_BUCKET,
});

const origins = [
  'https://cling-ai.com',
  'https://www.cling-ai.com',
  'http://localhost:5173',
  'http://localhost:3000',
];

const rules = [{
  allowedOrigin: origins,
  // OSS 会自动处理 OPTIONS 预检，只允许配置实际请求动词
  allowedMethod: ['GET', 'PUT', 'POST', 'HEAD', 'DELETE'],
  allowedHeader: ['*'],
  exposeHeader: ['ETag', 'x-oss-request-id', 'x-oss-next-append-position'],
  maxAgeSeconds: 3600,
}];

(async () => {
  try {
    console.log('Setting OSS CORS for bucket:', OSS_BUCKET);
    await client.putBucketCORS(OSS_BUCKET, rules);
    console.log('✅ CORS updated successfully');
  } catch (err) {
    console.error('❌ Failed to update OSS CORS:', err);
    process.exit(1);
  }
})();

