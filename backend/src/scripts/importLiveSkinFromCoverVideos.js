/**
 * Import existing (original) agent cover videos into previewVideos for LiveSkin.
 *
 * Goal: Stop relying on AI-generated clips when creators already have high-quality videos.
 * This script:
 * - picks source URLs preferring /uploads/ (original uploads)
 * - splits into multiple short clips and makes 2 shots: closeup + halfbody
 * - transcodes to iOS-friendly vertical 9:16 (1080x1920)
 * - uploads to R2 under liveskin/source/
 * - replaces previewVideos (with backup saved to previewVideosBackup)
 *
 * Usage (inside backend container):
 *   node src/scripts/importLiveSkinFromCoverVideos.js --concurrency=1
 *   node src/scripts/importLiveSkinFromCoverVideos.js --concurrency=2 --force
 *   node src/scripts/importLiveSkinFromCoverVideos.js --limit=3
 *   node src/scripts/importLiveSkinFromCoverVideos.js --target=10 --clip=4
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const connectDB = require('../config/db');
const Agent = require('../models/Agent');
const { uploadBufferToR2 } = require('../services/r2Client');
const { downloadToBuffer } = require('../services/runpodVideoService');

function argValue(name) {
  const p = process.argv.find((x) => x.startsWith(`${name}=`));
  return p ? p.split('=')[1] : null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function todayPrefix() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function run(cmd, args, { timeoutMs = 600000 } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const t = setTimeout(() => {
      try { p.kill('SIGKILL'); } catch {}
      reject(new Error(`${cmd} timeout`));
    }, timeoutMs);
    p.stdout.on('data', (d) => (stdout += d.toString()));
    p.stderr.on('data', (d) => (stderr += d.toString()));
    p.on('error', (e) => {
      clearTimeout(t);
      reject(e);
    });
    p.on('close', (code) => {
      clearTimeout(t);
      if (code === 0) return resolve({ stdout, stderr });
      reject(new Error(`${cmd} exited ${code}: ${stderr.slice(0, 4000)}`));
    });
  });
}

async function ffprobeDurationSeconds(filePath) {
  try {
    const { stdout } = await run('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'json',
      filePath,
    ], { timeoutMs: 60000 });
    const json = JSON.parse(stdout);
    const d = Number(json?.format?.duration || 0);
    return Number.isFinite(d) ? d : 0;
  } catch {
    return 0;
  }
}

function shotCropFilter(shot) {
  // We first scale to fill 9:16 then crop 1080x1920.
  // For closeup we bias upward (face) by using a smaller y offset.
  // For halfbody we bias slightly lower (torso).
  const targetW = 1080;
  const targetH = 1920;
  const ar = `${targetW}/${targetH}`;
  const scale = `scale='if(gt(a,${ar}),-2,${targetW})':'if(gt(a,${ar}),${targetH},-2)'`;
  const x = `(iw-${targetW})/2`;
  const bias = shot === 'closeup' ? 0.08 : 0.18;
  // Avoid commas in expressions (they break ffmpeg filter parsing unless escaped).
  // Scale step ensures ih >= targetH, so (ih-targetH) is >= 0.
  const y = `(ih-${targetH})*${bias}`;
  const crop = `crop=${targetW}:${targetH}:${x}:${y}`;
  return `${scale},${crop},setsar=1,format=yuv420p`;
}

async function transcodeClipToIOS({ inputPath, outputPath, startSec, durSec, shot }) {
  // H.264 for iOS, keep quality high.
  // We drop audio to avoid sync issues; iOS can use TTS.
  const vf = shotCropFilter(shot);
  const ss = Math.max(0, Number(startSec) || 0);
  const tt = Math.max(0.5, Number(durSec) || 4);

  await run('ffmpeg', [
    '-y',
    '-ss', String(ss),
    '-t', String(tt),
    '-i', inputPath,
    '-an',
    '-vf', vf,
    '-c:v', 'libx264',
    '-profile:v', 'high',
    '-level', '4.1',
    '-preset', 'slow',
    '-crf', '18',
    '-movflags', '+faststart',
    '-g', '24',
    '-keyint_min', '24',
    outputPath,
  ], { timeoutMs: 240000 });
}

function pickSourceUrls(agent) {
  const urls = [];
  const add = (u) => {
    if (!u || typeof u !== 'string') return;
    if (urls.includes(u)) return;
    urls.push(u);
  };

  // Strong preference: original uploads
  if (agent.coverVideoUrl && agent.coverVideoUrl.includes('/uploads/')) add(agent.coverVideoUrl);
  for (const u of agent.coverVideoUrls || []) if (u.includes('/uploads/')) add(u);

  // Secondary: anything that is NOT our generated liveskin folder
  if (!urls.length) {
    if (agent.coverVideoUrl) add(agent.coverVideoUrl);
    for (const u of agent.coverVideoUrls || []) {
      // generated pattern: /videos/YYYY-MM-DD/<agentId>/
      if (u.includes('/videos/') && u.includes(`/${agent._id.toString()}/`)) continue;
      add(u);
    }
  }

  // Fallback: just take first N
  if (!urls.length) {
    if (agent.coverVideoUrl) add(agent.coverVideoUrl);
    for (const u of agent.coverVideoUrls || []) add(u);
  }

  return urls.slice(0, 12);
}

async function importForAgent(agentId, { force = false, target = 10, clipSeconds = 4 } = {}) {
  const agent = await Agent.findById(agentId).select('_id name coverVideoUrl coverVideoUrls previewVideos liveSkinStatus avatarUrl avatarUrls');
  if (!agent) throw new Error('Agent not found');

  if (!force && agent.liveSkinStatus === 'ready' && Array.isArray(agent.previewVideos) && agent.previewVideos.length) {
    return { skipped: true, reason: 'already_ready' };
  }

  const sourceUrls = pickSourceUrls(agent);
  if (!sourceUrls.length) {
    await Agent.updateOne(
      { _id: agentId },
      { $set: { liveSkinStatus: 'failed', liveSkinLastError: 'No source cover videos to import' } },
      { strict: false }
    );
    return { skipped: true, reason: 'no_source' };
  }

  // Backup (once)
  await Agent.updateOne(
    { _id: agentId, previewVideosBackup: { $exists: false } },
    {
      $set: {
        previewVideosBackup: agent.previewVideos || [],
        coverVideoUrlsBackup: agent.coverVideoUrls || [],
      },
    },
    { strict: false }
  );

  await Agent.updateOne(
    { _id: agentId },
    { $set: { liveSkinStatus: 'generating', liveSkinLastError: '' } },
    { strict: false }
  );

  // We aim for 8-10 clips per agent using 2 shots (closeup+halfbody)
  const targetClips = Math.max(8, Math.min(10, Number(target) || 10));
  const shots = ['closeup', 'halfbody'];
  const perSegment = shots.length;
  const segments = Math.max(1, Math.ceil(targetClips / perSegment));
  const clipLen = Math.max(2, Math.min(8, Number(clipSeconds) || 4));

  const out = [];
  let sortOrder = 0;

  // Use the best single "original" URL as base (we can extend later to multi-url).
  const baseUrl = sourceUrls[0];
  const baseBuf = await downloadToBuffer(baseUrl);
  if (!baseBuf || baseBuf.length < 4096) {
    throw new Error(`Base video download invalid (len=${baseBuf?.length || 0})`);
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'liveskin-import-'));
  const inPath = path.join(tmp, 'in.mp4');
  fs.writeFileSync(inPath, baseBuf);

  const duration = await ffprobeDurationSeconds(inPath);
  const usable = duration && duration > clipLen + 0.5 ? duration : 0;
  // Evenly spaced start times
  const starts = [];
  if (!usable) {
    starts.push(0);
  } else {
    const maxStart = Math.max(0, usable - clipLen);
    for (let i = 0; i < segments; i += 1) {
      const t = segments === 1 ? 0 : (maxStart * i) / (segments - 1);
      starts.push(t);
    }
  }

  for (let i = 0; i < starts.length; i += 1) {
    for (const shot of shots) {
      if (out.length >= targetClips) break;

      const clipTmp = path.join(tmp, `clip_${i}_${shot}.mp4`);
      await transcodeClipToIOS({ inputPath: inPath, outputPath: clipTmp, startSec: starts[i], durSec: clipLen, shot });
      const finalBuf = fs.readFileSync(clipTmp);

      const key = `liveskin/source/${todayPrefix()}/${agentId}/${shot}-${i}-${crypto.randomUUID()}.mp4`;
      const up = await uploadBufferToR2(finalBuf, key, 'video/mp4');

      const tags = ['source', shot];
      // First two clips become idle defaults
      if (out.length < 2) tags.unshift('idle', 'loopable');

      out.push({
        url: up.url,
        thumbnailUrl: (agent.avatarUrls && agent.avatarUrls[0]) || agent.avatarUrl || '',
        duration: clipLen,
        width: 1080,
        height: 1920,
        fileSize: finalBuf.length,
        format: 'mp4',
        isVertical: true,
        sortOrder,
        tags,
        scaleLevel: 1,
      });
      sortOrder += 1;
    }
  }

  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}

  if (!out.length) {
    await Agent.updateOne(
      { _id: agentId },
      { $set: { liveSkinStatus: 'failed', liveSkinLastError: 'Import produced 0 usable videos' } },
      { strict: false }
    );
    return { skipped: true, reason: 'import_empty' };
  }

  await Agent.updateOne(
    { _id: agentId },
    {
      $set: {
        previewVideos: out,
        defaultPreviewIndex: 0,
        liveSkinStatus: 'ready',
        liveSkinGeneratedAt: new Date(),
        liveSkinLastError: '',
      },
    },
    { strict: false }
  );

  return { ok: true, imported: out.length, sourceUrls: sourceUrls.length, durationSeconds: duration || 0 };
}

async function main() {
  const concurrency = Math.max(1, Math.min(5, parseInt(argValue('--concurrency') || '1', 10) || 1));
  const force = hasFlag('--force');
  const limit = Math.max(0, parseInt(argValue('--limit') || '0', 10) || 0);
  const target = Math.max(8, Math.min(10, parseInt(argValue('--target') || '10', 10) || 10));
  const clipSeconds = Math.max(2, Math.min(8, parseFloat(argValue('--clip') || '4') || 4));

  console.log('[LiveSkinImport] starting', { concurrency, force, limit, target, clipSeconds });
  await connectDB();

  const agents = await Agent.find({}).select('_id name liveSkinStatus coverVideoUrl coverVideoUrls').sort({ createdAt: -1 });
  const list = limit > 0 ? agents.slice(0, limit) : agents;
  console.log('[LiveSkinImport] agents', list.length);

  let idx = 0;
  const stats = { ok: 0, skipped: 0, failed: 0 };

  const worker = async (workerId) => {
    while (idx < list.length) {
      const cur = list[idx++];
      const agentId = cur._id.toString();
      try {
        console.log(`[LiveSkinImport] [w${workerId}] importing`, cur.name, agentId);
        const res = await importForAgent(agentId, { force, target, clipSeconds });
        if (res?.ok) {
          stats.ok += 1;
          console.log(`[LiveSkinImport] [w${workerId}] done`, cur.name, res);
        } else {
          stats.skipped += 1;
          console.log(`[LiveSkinImport] [w${workerId}] skipped`, cur.name, res);
        }
      } catch (e) {
        stats.failed += 1;
        console.error(`[LiveSkinImport] [w${workerId}] FAILED`, cur.name, agentId, e?.message || e);
        await Agent.updateOne(
          { _id: agentId },
          { $set: { liveSkinStatus: 'failed', liveSkinLastError: e?.message || String(e) } },
          { strict: false }
        );
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i + 1)));
  console.log('[LiveSkinImport] finished', stats);
  process.exit(0);
}

main().catch((e) => {
  console.error('[LiveSkinImport] fatal', e);
  process.exit(1);
});

