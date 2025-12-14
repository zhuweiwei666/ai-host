const express = require('express');
const router = express.Router();

const Agent = require('../models/Agent');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const { sendSuccess, errors, HTTP_STATUS } = require('../utils/errorHandler');
const { generateClipsForAgent, DEFAULT_ACTIONS } = require('../services/liveSkinService');

// Admin-only
router.use(requireAuth);
router.use(requireAdmin);

/**
 * POST /api/admin/live-skin/generate/:agentId
 * Trigger video-first LiveSkin clip generation for one agent using RunPod.
 *
 * Body (optional):
 * - imageUrl: override source image (otherwise use agent.avatarUrls[0]/avatarUrl)
 * - actions: override action list (advanced)
 */
router.post('/generate/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const { imageUrl, actions } = req.body || {};

  try {
    const agent = await Agent.findById(agentId).select('_id name avatarUrl avatarUrls');
    if (!agent) return errors.notFound(res, 'Agent not found');

    // Fire-and-forget background job (simple MVP).
    // NOTE: If process restarts, job is lost. For production, move to a persistent job queue.
    const jobId = `liveskin_${agentId}_${Date.now()}`;
    sendSuccess(res, HTTP_STATUS.ACCEPTED, { jobId, status: 'queued', agentId, agentName: agent.name });

    setImmediate(async () => {
      try {
        console.log(`[LiveSkin] Job ${jobId} start for agent ${agentId} (${agent.name})`);
        const out = await generateClipsForAgent({
          agentId,
          imageUrl,
          actions: Array.isArray(actions) && actions.length ? actions : DEFAULT_ACTIONS,
        });
        console.log(`[LiveSkin] Job ${jobId} done: ok=${out.ok} failed=${out.failed}`);
      } catch (e) {
        console.error(`[LiveSkin] Job ${jobId} failed:`, e?.message || e);
        try {
          await Agent.updateOne(
            { _id: agentId },
            { $set: { liveSkinStatus: 'failed', liveSkinLastError: e?.message || String(e) } },
            { strict: false }
          );
        } catch (updateErr) {
          console.error('[LiveSkin] Failed to update agent status:', updateErr?.message || updateErr);
        }
      }
    });
  } catch (e) {
    console.error('[POST /api/admin/live-skin/generate/:agentId] Error:', e);
    return errors.internalError(res, e?.message || 'Failed to queue LiveSkin generation');
  }
});

module.exports = router;

