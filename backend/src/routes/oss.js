const express = require('express');
const { STS } = require('ali-oss');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/oss/sts - Get temporary STS credentials for direct OSS upload
// Use optionalAuth to allow mock user ID in development
router.get('/sts', optionalAuth, async (req, res) => {
  try {
    // Log authentication status for debugging
    const userId = req.user?.id || 'anonymous';
    console.log(`[OSS STS] Request from user: ${userId}`);
    
    // Validate required environment variables
    if (!process.env.OSS_ACCESS_KEY_ID || !process.env.OSS_ACCESS_KEY_SECRET) {
      return res.status(500).json({ 
        error: 'OSS credentials not configured. Please set OSS_ACCESS_KEY_ID and OSS_ACCESS_KEY_SECRET in .env.production.local' 
      });
    }

    const STSClient = new STS({
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    });

    // Policy: Allow PutObject only to the specified bucket and base path
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

    // Note: This requires a RAM role to be created in Alibaba Cloud
    // Role ARN format: acs:ram::<AccountID>:role/<RoleName>
    // For now, we'll use a placeholder. User must create the role and update this.
    const roleArn = process.env.OSS_ROLE_ARN || 'acs:ram::123456789:role/aliyunossupload';

    const result = await STSClient.assumeRole(
      roleArn,
      policy,
      3600 // 1 hour expiration
    );

    res.json({
      accessKeyId: result.credentials.AccessKeyId,
      accessKeySecret: result.credentials.AccessKeySecret,
      securityToken: result.credentials.SecurityToken,
      expiration: result.credentials.Expiration,
      bucket: process.env.OSS_BUCKET,
      region: process.env.OSS_REGION,
      endpoint: process.env.OSS_ENDPOINT,
      basePath: process.env.OSS_BASE_PATH || 'uploads',
    });
  } catch (err) {
    console.error('[OSS] STS credential generation failed:', err);
    res.status(500).json({ 
      error: err.message || 'Failed to generate STS credentials',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

module.exports = router;

