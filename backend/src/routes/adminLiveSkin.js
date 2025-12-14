const express = require('express');
const router = express.Router();

const Agent = require('../models/Agent');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const { sendSuccess, errors, HTTP_STATUS } = require('../utils/errorHandler');
const { generateClipsForAgent, DEFAULT_ACTIONS } = require('../services/liveSkinService');
const connectDB = require('../config/db');

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

/**
 * POST /api/admin/live-skin/generate-all
 * Batch-generate LiveSkin clips for all agents.
 *
 * Body (optional):
 * - concurrency: number (default 1)  // RunPod GPU safety; increase carefully
 * - force: boolean (default false)   // if false, skip agents with liveSkinStatus=ready
 * - limit: number (default 0)        // for smoke tests
 */
router.post('/generate-all', async (req, res) => {
  const { concurrency = 1, force = false, limit = 0 } = req.body || {};

  const conc = Math.max(1, Math.min(5, parseInt(concurrency, 10) || 1));
  const lim = Math.max(0, parseInt(limit, 10) || 0);

  try {
    const jobId = `liveskin_all_${Date.now()}`;

    sendSuccess(res, HTTP_STATUS.ACCEPTED, {
      jobId,
      status: 'queued',
      concurrency: conc,
      force: !!force,
      limit: lim,
    });

    setImmediate(async () => {
      try {
        await connectDB();
      } catch (e) {
        console.error('[LiveSkin] Batch connectDB failed:', e?.message || e);
      }

      const agents = await Agent.find({})
        .select('_id name avatarUrl avatarUrls liveSkinStatus')
        .sort({ createdAt: -1 });

      const list = lim > 0 ? agents.slice(0, lim) : agents;
      console.log(`[LiveSkin] Batch ${jobId} start: agents=${list.length} concurrency=${conc} force=${!!force}`);

      let idx = 0;
      const results = { ok: 0, skipped: 0, failed: 0 };

      const worker = async () => {
        while (idx < list.length) {
          const cur = list[idx++];
          const agentId = cur._id.toString();
          if (!force && cur.liveSkinStatus === 'ready') {
            results.skipped += 1;
            continue;
          }
          try {
            console.log(`[LiveSkin] Batch ${jobId} generating: ${cur.name} (${agentId})`);
            const out = await generateClipsForAgent({ agentId, actions: DEFAULT_ACTIONS });
            results.ok += 1;
            console.log(`[LiveSkin] Batch ${jobId} done: ${cur.name} ok=${out.ok} failed=${out.failed}`);
          } catch (e) {
            results.failed += 1;
            console.error(`[LiveSkin] Batch ${jobId} FAILED: ${cur.name} (${agentId})`, e?.message || e);
            try {
              await Agent.updateOne(
                { _id: agentId },
                { $set: { liveSkinStatus: 'failed', liveSkinLastError: e?.message || String(e) } },
                { strict: false }
              );
            } catch {}
          }
        }
      };

      await Promise.all(Array.from({ length: conc }, () => worker()));
      console.log(`[LiveSkin] Batch ${jobId} finished:`, results);
    });
  } catch (e) {
    console.error('[POST /api/admin/live-skin/generate-all] Error:', e);
    return errors.internalError(res, e?.message || 'Failed to queue LiveSkin batch generation');
  }
});

module.exports = router;

