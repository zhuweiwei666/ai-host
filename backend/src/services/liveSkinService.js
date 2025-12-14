const crypto = require('crypto');
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
  { name: 'idle_1', tags: ['idle', 'loopable'], motion: 40, fps: 8, frames: 25, loop: true, sortOrder: 0 },
  { name: 'idle_2', tags: ['idle', 'loopable'], motion: 50, fps: 8, frames: 25, loop: true, sortOrder: 1 },
  { name: 'talk_1', tags: ['talk'], motion: 80, fps: 12, frames: 20, loop: false, sortOrder: 10 },
  { name: 'react_happy', tags: ['react_happy'], motion: 100, fps: 10, frames: 15, loop: false, sortOrder: 20 },
  { name: 'react_shy', tags: ['react_shy'], motion: 60, fps: 10, frames: 15, loop: false, sortOrder: 21 },
  { name: 'react_flirty', tags: ['react_flirty'], motion: 85, fps: 10, frames: 15, loop: false, sortOrder: 22 },
  { name: 'react_sad', tags: ['react_sad'], motion: 50, fps: 10, frames: 15, loop: false, sortOrder: 23 },
];

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

  // Mark status (schema might not have this field; routes use strict:false, but we keep updateOne strict via $set).
  await Agent.updateOne(
    { _id: agentId },
    { $set: { liveSkinStatus: 'generating', liveSkinGeneratedAt: null, liveSkinLastError: '' } },
    { strict: false }
  );

  const results = [];
  for (const a of actions) {
    const { name, tags, motion, fps, frames, loop, sortOrder } = a;
    try {
      const gen = await generateVideoFromImage({ imageUrl: srcImage, motion, fps, frames, loop });
      const videoBuf = await downloadToBuffer(gen.videoUrl);

      const key = `videos/${todayPrefix()}/${agentId}/${name}-${crypto.randomUUID()}.mp4`;
      const up = await uploadBufferToR2(videoBuf, key, 'video/mp4');

      const duration = fps ? frames / fps : 0;
      const entry = {
        url: up.url,
        thumbnailUrl: agent.avatarUrls?.[0] || agent.avatarUrl || '',
        duration,
        width: 0,
        height: 0,
        fileSize: videoBuf.length,
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

  const newEntries = results.filter((r) => r.ok && r.entry).map((r) => r.entry);
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

  // Optional: sync legacy coverVideoUrls so old clients still see videos
  const coverUrls = merged.map((v) => v.url).filter(Boolean);
  await Agent.updateOne({ _id: agentId }, { $set: { coverVideoUrls: coverUrls } }, { strict: false });

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
  generateClipsForAgent,
};

