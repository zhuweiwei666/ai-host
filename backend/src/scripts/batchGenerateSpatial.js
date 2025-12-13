/**
 * Batch-generate spatial avatar asset packs for all agents.
 *
 * Usage (inside backend container):
 *   node src/scripts/batchGenerateSpatial.js            # skip already bound
 *   node src/scripts/batchGenerateSpatial.js --force    # regenerate all
 *
 * WHY: one-click "generate 3D avatar for every agent" without needing an admin JWT.
 */
const connectDB = require('../config/db');
const Agent = require('../models/Agent');
const { generateAvatarAssetPack } = require('../services/avatarAssetService');

function argHas(flag) {
  return process.argv.includes(flag);
}

async function main() {
  const force = argHas('--force');
  const dryRun = argHas('--dry-run');

  await connectDB();

  const agents = await Agent.find({}).select('_id name avatarUrl avatarUrls avatarSpatialMetaUrl').lean();

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const a of agents) {
    const agentId = String(a._id);
    const hasMeta = !!(a.avatarSpatialMetaUrl && a.avatarSpatialMetaUrl.length);
    const imageUrl = (Array.isArray(a.avatarUrls) && a.avatarUrls[0]) || a.avatarUrl;

    if (!force && hasMeta) {
      skipped++;
      console.log(`[SKIP] ${agentId} ${a.name} already_bound`);
      continue;
    }
    if (!imageUrl) {
      skipped++;
      console.log(`[SKIP] ${agentId} ${a.name} missing_avatar`);
      continue;
    }

    console.log(`[GEN] ${agentId} ${a.name} ${imageUrl}`);

    try {
      if (dryRun) {
        ok++;
        console.log(`[OK] ${agentId} ${a.name} (dry-run)`);
        continue;
      }

      const out = await generateAvatarAssetPack({
        imageUrl,
        userId: 'batch',
        agentId,
      });

      await Agent.updateOne({ _id: a._id }, { $set: { avatarSpatialMetaUrl: out.metaUrl } });
      ok++;
      console.log(`[OK] ${agentId} ${a.name} ${out.metaUrl}`);
    } catch (e) {
      failed++;
      console.log(`[FAIL] ${agentId} ${a.name} ${(e && e.message) || String(e)}`);
    }
  }

  console.log(
    `DONE total=${agents.length} ok=${ok} skipped=${skipped} failed=${failed} force=${force} dryRun=${dryRun}`,
  );
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});

