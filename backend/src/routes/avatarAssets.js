const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const { errors, sendSuccess, HTTP_STATUS } = require('../utils/errorHandler');
const { generateAvatarAssetPack } = require('../services/avatarAssetService');
const Agent = require('../models/Agent');

// POST /api/avatar-assets/generate
// Body: { imageUrl: string, agentId?: string, bindToAgent?: boolean }
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const { imageUrl, agentId, bindToAgent } = req.body || {};
    if (!imageUrl) {
      return errors.badRequest(res, 'Missing imageUrl');
    }

    const out = await generateAvatarAssetPack({
      imageUrl,
      userId: req.user?.id,
      agentId,
    });

    // Optional: bind metaUrl to agent globally (admin only)
    if (bindToAgent && agentId) {
      if (req.user?.role !== 'admin') {
        return errors.adminRequired(res);
      }
      await Agent.findOneAndUpdate(
        { _id: agentId },
        { $set: { avatarSpatialMetaUrl: out.metaUrl } },
        { new: false, strict: false }
      );
    }

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

// POST /api/avatar-assets/generate-all (Admin only)
// Body: { force?: boolean }
// WHY: batch-generate spatial 3D packs for all agents and bind avatarSpatialMetaUrl.
router.post('/generate-all', requireAuth, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return errors.adminRequired(res);

    const { force = false } = req.body || {};
    const agents = await Agent.find({}).select('_id name avatarUrl avatarUrls avatarSpatialMetaUrl');

    const results = [];
    for (const a of agents) {
      try {
        if (!force && a.avatarSpatialMetaUrl) {
          results.push({ agentId: a._id, name: a.name, skipped: true, reason: 'already_bound' });
          continue;
        }
        const imageUrl = (Array.isArray(a.avatarUrls) && a.avatarUrls[0]) || a.avatarUrl;
        if (!imageUrl) {
          results.push({ agentId: a._id, name: a.name, skipped: true, reason: 'missing_avatar' });
          continue;
        }

        const out = await generateAvatarAssetPack({
          imageUrl,
          userId: req.user?.id,
          agentId: a._id.toString(),
        });

        await Agent.findOneAndUpdate(
          { _id: a._id },
          { $set: { avatarSpatialMetaUrl: out.metaUrl } },
          { new: false, strict: false }
        );

        results.push({ agentId: a._id, name: a.name, metaUrl: out.metaUrl, ok: true });
      } catch (e) {
        results.push({ agentId: a._id, name: a.name, ok: false, error: e?.message || String(e) });
      }
    }

    return sendSuccess(res, HTTP_STATUS.OK, {
      total: agents.length,
      ok: results.filter((r) => r.ok).length,
      skipped: results.filter((r) => r.skipped).length,
      failed: results.filter((r) => r.ok === false).length,
      results,
    });
  } catch (err) {
    console.error('[avatar-assets] generate-all failed:', err);
    return errors.internalError(res, 'Avatar asset batch generation failed', { error: err.message });
  }
});

module.exports = router;
