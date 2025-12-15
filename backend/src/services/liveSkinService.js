const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const Agent = require('../models/Agent');
const { uploadBufferToR2 } = require('./r2Client');
const { generateVideoFromImage, downloadToBuffer } = require('./runpodVideoService');

function todayPrefix() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

const DEFAULT_ACTIONS = [
  // Idle should be smooth and truly loopable
  { name: 'idle_1', tags: ['idle', 'loopable'], motion: 28, fps: 12, frames: 36, loop: true, steps: 30, sortOrder: 0 },
  { name: 'idle_2', tags: ['idle', 'loopable'], motion: 36, fps: 12, frames: 36, loop: true, steps: 30, sortOrder: 1 },
  // A bit more motion for speaking / emphasis
  { name: 'talk_1', tags: ['talk'], motion: 55, fps: 12, frames: 24, loop: false, steps: 25, sortOrder: 10 },
  { name: 'talk_2', tags: ['talk'], motion: 70, fps: 12, frames: 24, loop: false, steps: 25, sortOrder: 11 },
  { name: 'react_happy', tags: ['react_happy'], motion: 75, fps: 12, frames: 18, loop: false, steps: 25, sortOrder: 20 },
  { name: 'react_shy', tags: ['react_shy'], motion: 45, fps: 12, frames: 18, loop: false, steps: 25, sortOrder: 21 },
  { name: 'react_flirty', tags: ['react_flirty'], motion: 65, fps: 12, frames: 18, loop: false, steps: 25, sortOrder: 22 },
  { name: 'react_sad', tags: ['react_sad'], motion: 40, fps: 12, frames: 18, loop: false, steps: 25, sortOrder: 23 },
  { name: 'react_angry', tags: ['react_angry'], motion: 70, fps: 12, frames: 18, loop: false, steps: 25, sortOrder: 24 },
  { name: 'react_surprised', tags: ['react_surprised'], motion: 85, fps: 12, frames: 18, loop: false, steps: 25, sortOrder: 25 },
  // Additional emotional flavors for immersion
  { name: 'react_caring', tags: ['react_caring'], motion: 48, fps: 12, frames: 18, loop: false, steps: 25, sortOrder: 26 },
  { name: 'react_excited', tags: ['react_excited'], motion: 90, fps: 12, frames: 18, loop: false, steps: 25, sortOrder: 27 },
  { name: 'react_thinking', tags: ['react_thinking'], motion: 35, fps: 12, frames: 18, loop: false, steps: 25, sortOrder: 28 },
  { name: 'react_laugh', tags: ['react_laugh'], motion: 80, fps: 12, frames: 18, loop: false, steps: 25, sortOrder: 29 },
];

function stableActionSeed(baseSeed, sortOrder = 0) {
  // 31-bit positive int (FastAPI treats seed=0 as "random")
  const s = (Number(baseSeed) + Number(sortOrder) * 9973) % 2147483647;
  return s <= 0 ? 1 : s;
}

function run(cmd, args, { timeoutMs = 180000 } = {}) {
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

async function transcodeForIOS({ inputBuffer, targetW = 1080, targetH = 1920 }) {
  // Requires ffmpeg in container
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'liveskin-'));
  const inPath = path.join(tmp, 'in.mp4');
  const outPath = path.join(tmp, 'out.mp4');
  fs.writeFileSync(inPath, inputBuffer);

  // Crop+scale to fill 9:16, ensure SAR=1, yuv420p, faststart.
  // - If source is wider than 9:16 -> scale by height and crop width.
  // - If source is taller -> scale by width and crop height.
  const vf = [
    `scale='if(gt(a,${targetW}/${targetH}),-2,${targetW})':'if(gt(a,${targetW}/${targetH}),${targetH},-2)'`,
    `crop=${targetW}:${targetH}`,
    'setsar=1',
    'format=yuv420p',
  ].join(',');

  // H.264 baseline-ish for max compatibility; CRF tuned for quality.
  await run('ffmpeg', [
    '-y',
    '-i', inPath,
    '-an',
    '-vf', vf,
    '-c:v', 'libx264',
    '-profile:v', 'high',
    '-level', '4.1',
    '-preset', 'veryfast',
    '-crf', '20',
    '-movflags', '+faststart',
    // keyframes every ~1s (helps fast switching)
    '-g', '12',
    '-keyint_min', '12',
    outPath,
  ], { timeoutMs: 240000 });

  const outBuf = fs.readFileSync(outPath);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  return outBuf;
}

async function generateClipsForAgent({
  agentId,
  imageUrl,
  actions = DEFAULT_ACTIONS,
  overwriteTags = false,
}) {
  const agent = await Agent.findById(agentId);
  if (!agent) throw new Error('Agent not found');

  const srcImage = imageUrl || agent.avatarUrls?.[0] || agent.avatarUrl;
  if (!srcImage) throw new Error('Missing imageUrl/avatar for agent');

  // Stable seed per agent to reduce identity drift across multiple generated clips
  let baseSeed = Number(agent.liveSkinSeed) || 0;
  if (!baseSeed) {
    baseSeed = crypto.randomInt(1, 2147483647);
    await Agent.updateOne({ _id: agentId }, { $set: { liveSkinSeed: baseSeed } }, { strict: false });
  }

  // Mark status (schema might not have this field; routes use strict:false, but we keep updateOne strict via $set).
  await Agent.updateOne(
    { _id: agentId },
    { $set: { liveSkinStatus: 'generating', liveSkinGeneratedAt: null, liveSkinLastError: '' } },
    { strict: false }
  );

  const results = [];
  for (const a of actions) {
    const { name, tags, motion, fps, frames, loop, sortOrder, steps } = a;
    try {
      const seed = stableActionSeed(baseSeed, sortOrder);
      const gen = await generateVideoFromImage({
        imageUrl: srcImage,
        motion,
        fps,
        frames,
        loop,
        seed,
        steps,
        min_guidance: 1.0,
        max_guidance: 3.0,
        noise_aug: 0.02,
      });
      const videoBuf = await downloadToBuffer(gen.videoUrl);
      // Make output iOS-friendly and correct aspect ratio
      let finalVideoBuf = videoBuf;
      try {
        finalVideoBuf = await transcodeForIOS({ inputBuffer: videoBuf });
      } catch (e) {
        console.warn('[LiveSkin] transcode skipped/failed, uploading original:', e?.message || e);
      }

      const key = `videos/${todayPrefix()}/${agentId}/${name}-${crypto.randomUUID()}.mp4`;
      const up = await uploadBufferToR2(finalVideoBuf, key, 'video/mp4');

      const duration = fps ? frames / fps : 0;
      const entry = {
        url: up.url,
        thumbnailUrl: agent.avatarUrls?.[0] || agent.avatarUrl || '',
        duration,
        width: 0,
        height: 0,
        fileSize: finalVideoBuf.length,
        format: 'mp4',
        isVertical: true,
        sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
        tags: ensureArray(tags),
        scaleLevel: 1,
      };

      results.push({ name, ok: true, url: up.url, key: up.key, entry });
    } catch (e) {
      results.push({ name: a.name, ok: false, error: e?.message || String(e) });
    }
  }

  // Merge into previewVideos (append)
  const fresh = await Agent.findById(agentId).select('previewVideos defaultPreviewIndex');
  const current = ensureArray(fresh?.previewVideos);

  const newEntriesRaw = results.filter((r) => r.ok && r.entry).map((r) => r.entry);
  // Avoid sortOrder collisions: push new entries after existing ones
  const maxSortOrder = current.reduce((m, v) => Math.max(m, typeof v?.sortOrder === 'number' ? v.sortOrder : 0), 0);
  const baseSortOrder = (maxSortOrder || 0) + 100;
  const newEntries = newEntriesRaw.map((e) => ({
    ...e,
    sortOrder: baseSortOrder + (typeof e.sortOrder === 'number' ? e.sortOrder : 0),
  }));

  const merged = overwriteTags
    ? current.concat(newEntries)
    : current.concat(
        newEntries.map((e) => ({
          ...e,
          tags: ensureArray(e.tags),
        }))
      );

  // Ensure at least one idle is default
  const defaultIdx = merged.findIndex((v) => ensureArray(v.tags).includes('idle'));
  const nextDefaultIndex = defaultIdx >= 0 ? defaultIdx : (fresh?.defaultPreviewIndex || 0);

  await Agent.updateOne(
    { _id: agentId },
    {
      $set: {
        previewVideos: merged,
        defaultPreviewIndex: nextDefaultIndex,
        liveSkinStatus: 'ready',
        liveSkinGeneratedAt: new Date(),
        liveSkinLastError: '',
      },
    },
    { strict: false }
  );

  return {
    agentId,
    sourceImageUrl: srcImage,
    total: results.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

module.exports = {
  DEFAULT_ACTIONS,
  transcodeForIOS,
  generateClipsForAgent,
};

