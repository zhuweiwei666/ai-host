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

    // Check if using root account (cannot use AssumeRole)
    // If OSS_ROLE_ARN is not set or is placeholder, use direct AccessKey (less secure but works)
    const roleArn = process.env.OSS_ROLE_ARN;
    const isRootAccount = !roleArn || roleArn.includes('123456789') || roleArn.includes('placeholder');
    
    if (isRootAccount) {
      // Root account cannot use AssumeRole, return AccessKey directly
      // WARNING: This is less secure but necessary for root accounts
      // For production, create a RAM sub-user and use its AccessKey
      console.warn('[OSS STS] Using root account AccessKey directly (not recommended for production)');
      
      res.json({
        accessKeyId: process.env.OSS_ACCESS_KEY_ID,
        accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
        securityToken: '', // No STS token for root account
        expiration: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        bucket: process.env.OSS_BUCKET,
        region: process.env.OSS_REGION,
        endpoint: process.env.OSS_ENDPOINT,
        basePath: process.env.OSS_BASE_PATH || 'uploads',
      });
    } else {
      // Use RAM role with AssumeRole (more secure, recommended)
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
    }
  } catch (err) {
    console.error('[OSS] STS credential generation failed:', err);
    res.status(500).json({ 
      error: err.message || 'Failed to generate STS credentials',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

module.exports = router;

