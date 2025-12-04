/**
 * Test OSS connection and upload
 * Run: node scripts/test_oss_connection.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const OSS = require('ali-oss');

async function testOSSConnection() {
  console.log('=== OSS Connection Test ===\n');

  // Check environment variables
  const config = {
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET,
    region: process.env.OSS_REGION,
    endpoint: process.env.OSS_ENDPOINT,
  };

  console.log('Configuration:');
  console.log('  Bucket:', config.bucket);
  console.log('  Region:', config.region);
  console.log('  Endpoint:', config.endpoint);
  console.log('  AccessKey ID:', config.accessKeyId ? config.accessKeyId.substring(0, 10) + '...' : 'NOT SET');
  console.log('  AccessKey Secret:', config.accessKeySecret ? '***' : 'NOT SET');
  console.log('');

  if (!config.accessKeyId || !config.accessKeySecret) {
    console.error('❌ OSS credentials not configured!');
    return;
  }

  if (!config.bucket || !config.region) {
    console.error('❌ OSS bucket or region not configured!');
    return;
  }

  // Create OSS client
  const clientConfig = {
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    bucket: config.bucket,
    region: config.region,
    secure: true,
  };

  if (config.endpoint) {
    let endpoint = config.endpoint.replace(/^https?:\/\//, '').replace(/\/$/, '');
    clientConfig.endpoint = endpoint;
    console.log('Using explicit endpoint:', endpoint);
  }

  console.log('Creating OSS client...');
  const client = new OSS(clientConfig);

  try {
    // Test 1: List buckets (requires oss:ListBuckets permission)
    console.log('\n[Test 1] Listing buckets...');
    try {
      const buckets = await client.listBuckets();
      console.log('✅ Successfully listed buckets:', buckets.buckets?.length || 0, 'buckets');
    } catch (err) {
      console.log('⚠️  Cannot list buckets (may not have permission):', err.message);
    }

    // Test 2: Get bucket info
    console.log('\n[Test 2] Getting bucket info...');
    try {
      const info = await client.getBucketInfo(config.bucket);
      console.log('✅ Bucket info:', {
        name: info.bucket?.Name,
        location: info.bucket?.Location,
        creationDate: info.bucket?.CreationDate,
      });
    } catch (err) {
      console.log('⚠️  Cannot get bucket info:', err.message);
    }

    // Test 3: Upload a small test file
    console.log('\n[Test 3] Uploading test file...');
    const testContent = Buffer.from('Hello OSS! This is a test file.');
    const testKey = `test/connection-test-${Date.now()}.txt`;

    try {
      const result = await client.put(testKey, testContent, {
        headers: {
          'Content-Type': 'text/plain',
        },
      });
      console.log('✅ Upload successful!');
      console.log('   URL:', result.url);
      console.log('   Name:', result.name);

      // Test 4: Delete test file
      console.log('\n[Test 4] Cleaning up test file...');
      try {
        await client.delete(testKey);
        console.log('✅ Test file deleted');
      } catch (err) {
        console.log('⚠️  Cannot delete test file:', err.message);
      }
    } catch (err) {
      console.error('❌ Upload failed!');
      console.error('   Error:', err.message);
      console.error('   Code:', err.code);
      console.error('   Status:', err.status);
      console.error('   RequestId:', err.requestId);
      if (err.code === 'SignatureDoesNotMatch') {
        console.error('\n💡 Possible causes:');
        console.error('   1. AccessKey ID or Secret is incorrect');
        console.error('   2. AccessKey does not have oss:PutObject permission');
        console.error('   3. Server time is out of sync (current time:', new Date().toISOString(), ')');
        console.error('   4. Region or endpoint configuration mismatch');
      }
      throw err;
    }

    console.log('\n✅ All tests passed! OSS connection is working correctly.');
  } catch (err) {
    console.error('\n❌ OSS connection test failed!');
    process.exit(1);
  }
}

testOSSConnection().catch(console.error);

