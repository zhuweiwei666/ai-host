/**
 * Batch-generate LiveSkin videos for all agents (RunPod -> R2 -> MongoDB).
 *
 * Usage (inside backend container):
 *   node src/scripts/generateLiveSkinAll.js --concurrency=1
 *   node src/scripts/generateLiveSkinAll.js --concurrency=2 --force
 *   node src/scripts/generateLiveSkinAll.js --limit=3
 */

const connectDB = require('../config/db');
const Agent = require('../models/Agent');
const { generateClipsForAgent, DEFAULT_ACTIONS } = require('../services/liveSkinService');

function argValue(name) {
  const p = process.argv.find((x) => x.startsWith(`${name}=`));
  return p ? p.split('=')[1] : null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

async function main() {
  const concurrency = Math.max(1, Math.min(5, parseInt(argValue('--concurrency') || '1', 10) || 1));
  const force = hasFlag('--force');
  const limit = Math.max(0, parseInt(argValue('--limit') || '0', 10) || 0);

  console.log('[LiveSkinAll] starting', { concurrency, force, limit });
  await connectDB();

  const agents = await Agent.find({}).select('_id name liveSkinStatus avatarUrls avatarUrl').sort({ createdAt: -1 });
  const list = limit > 0 ? agents.slice(0, limit) : agents;
  console.log('[LiveSkinAll] agents', list.length);

  let idx = 0;
  const stats = { ok: 0, skipped: 0, failed: 0 };

  const worker = async (workerId) => {
    while (idx < list.length) {
      const cur = list[idx++];
      const agentId = cur._id.toString();
      if (!force && cur.liveSkinStatus === 'ready') {
        stats.skipped += 1;
        continue;
      }
      try {
        console.log(`[LiveSkinAll] [w${workerId}] generating`, cur.name, agentId);
        const out = await generateClipsForAgent({ agentId, actions: DEFAULT_ACTIONS });
        stats.ok += 1;
        console.log(`[LiveSkinAll] [w${workerId}] done`, cur.name, { ok: out.ok, failed: out.failed });
      } catch (e) {
        stats.failed += 1;
        console.error(`[LiveSkinAll] [w${workerId}] FAILED`, cur.name, agentId, e?.message || e);
        await Agent.updateOne(
          { _id: agentId },
          { $set: { liveSkinStatus: 'failed', liveSkinLastError: e?.message || String(e) } },
          { strict: false }
        );
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i + 1)));
  console.log('[LiveSkinAll] finished', stats);
  process.exit(0);
}

main().catch((e) => {
  console.error('[LiveSkinAll] fatal', e);
  process.exit(1);
});

