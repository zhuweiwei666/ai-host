const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { errors, sendSuccess, HTTP_STATUS } = require('../utils/errorHandler');
const { generateAvatarAssetPack } = require('../services/avatarAssetService');

// POST /api/avatar-assets/generate
// Body: { imageUrl: string, agentId?: string }
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const { imageUrl, agentId } = req.body || {};
    if (!imageUrl) {
      return errors.badRequest(res, 'Missing imageUrl');
    }

    const out = await generateAvatarAssetPack({
      imageUrl,
      userId: req.user?.id,
      agentId,
    });

    return sendSuccess(res, HTTP_STATUS.OK, out);
  } catch (err) {
    console.error('[avatar-assets] generate failed:', err);
    const details = {
      error: err.message,
    };
    if (err.response?.data) {
      details.falResponse = err.response.data;
    }
    return errors.badGateway(res, 'Avatar asset generation failed', {
      ...details,
    });
  }
});

module.exports = router;
