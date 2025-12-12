const axios = require('axios');
const crypto = require('crypto');
const sharp = require('sharp');

const { falRun } = require('./falQueueClient');
const { downloadAndUploadToOSS, uploadToOSS } = require('../utils/ossUpload');

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function pickFirstUrl(obj) {
  if (!obj || typeof obj !== 'object') return null;

  // Common fal shapes
  if (obj.image?.url) return obj.image.url;
  if (Array.isArray(obj.images) && obj.images[0]?.url) return obj.images[0].url;
  if (obj.depth_map?.url) return obj.depth_map.url;
  if (Array.isArray(obj.masks) && obj.masks[0]?.url) return obj.masks[0].url;

  // Fallback scan
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v?.url && typeof v.url === 'string') return v.url;
    if (Array.isArray(v) && v[0]?.url) return v[0].url;
  }

  return null;
}

async function downloadBuffer(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60_000 });
  return Buffer.from(res.data);
}

/**
 * Compute a normal map from a grayscale depth map.
 * WHY: normal map lets the shader add premium highlight/metal feel.
 */
async function depthToNormalPng(depthPngBuffer, { strength = 2.2 } = {}) {
  const { data, info } = await sharp(depthPngBuffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const depth = new Float32Array(width * height);

  // Convert to luminance 0..1
  for (let i = 0; i < width * height; i++) {
    const idx = i * channels;
    const r = data[idx] / 255;
    const g = channels > 1 ? data[idx + 1] / 255 : r;
    const b = channels > 2 ? data[idx + 2] / 255 : r;
    depth[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  const out = Buffer.alloc(width * height * 3);

  function dAt(x, y) {
    x = clamp(x, 0, width - 1);
    y = clamp(y, 0, height - 1);
    return depth[y * width + x];
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dzdx = (dAt(x + 1, y) - dAt(x - 1, y)) * strength;
      const dzdy = (dAt(x, y + 1) - dAt(x, y - 1)) * strength;

      // Normal points "out of screen" as +Z.
      let nx = -dzdx;
      let ny = -dzdy;
      let nz = 1.0;

      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;

      const o = (y * width + x) * 3;
      out[o] = Math.round((nx * 0.5 + 0.5) * 255);
      out[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[o + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    }
  }

  return sharp(out, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

/**
 * Generate a small FX noise texture (PNG).
 * WHY: gives the shader something to animate into energy streaks/sparkles without heavy video assets.
 */
async function generateFxTexturePng({ size = 256 } = {}) {
  // Single-channel noise -> expand to RGB via sharp.
  const noise = Buffer.alloc(size * size);
  crypto.randomFillSync(noise);

  // Create a slightly blurred, tile-friendly noise texture.
  const png = await sharp(noise, { raw: { width: size, height: size, channels: 1 } })
    .resize(size, size, { fit: 'fill' })
    .blur(0.8)
    .png()
    .toBuffer();

  return png;
}

/**
 * Generate an avatar "asset pack" via fal.ai.
 * Output is suitable for WebGL: base + depth + normal + cutout/mask + meta.
 */
async function generateAvatarAssetPack({ imageUrl, userId, agentId }) {
  if (!imageUrl) throw new Error('imageUrl is required');

  const jobId = crypto.randomUUID();
  const prefix = `avatar-assets/${agentId || userId || 'anon'}/${jobId}`;

  // 1) Run fal jobs in parallel
  // - Depth: marigold depth
  // - Mask/cutout: rembg (returns PNG with alpha)
  const [depthJob, cutoutJob] = await Promise.all([
    falRun('fal-ai/imageutils/marigold-depth', {
      image_url: imageUrl,
      // Keep costs reasonable; can raise for hero skins.
      // NOTE: lower defaults to avoid Cloudflare timeout; can be increased later.
      num_inference_steps: 8,
      ensemble_size: 4,
      processing_res: 512,
    }),
    falRun('fal-ai/imageutils/rembg', {
      image_url: imageUrl,
    }),
  ]);

  const depthUrl = pickFirstUrl(depthJob.result?.data || depthJob.result);
  const cutoutUrl = pickFirstUrl(cutoutJob.result?.data || cutoutJob.result);
  if (!depthUrl) throw new Error(`Depth model returned no url. raw=${JSON.stringify(depthJob.result).slice(0, 800)}`);
  if (!cutoutUrl) throw new Error(`Rembg model returned no url. raw=${JSON.stringify(cutoutJob.result).slice(0, 800)}`);

  // 2) Upload generated images to our storage
  const uploadedDepthUrl = await downloadAndUploadToOSS(depthUrl, `${prefix}-depth.png`, 'image/png');
  const uploadedCutoutUrl = await downloadAndUploadToOSS(cutoutUrl, `${prefix}-cutout.png`, 'image/png');

  // 3) Compute + upload normal map
  const depthBuf = await downloadBuffer(depthUrl);
  const normalBuf = await depthToNormalPng(depthBuf, { strength: 2.2 });
  const uploadedNormalUrl = await uploadToOSS(normalBuf, `${prefix}-normal.png`, 'image/png');

  // 4) Generate + upload FX texture (procedural)
  const fxBuf = await generateFxTexturePng({ size: 256 });
  const uploadedFxUrl = await uploadToOSS(fxBuf, `${prefix}-fx.png`, 'image/png');

  // 5) Meta JSON for frontend renderer
  const meta = {
    version: 1,
    jobId,
    agentId: agentId || null,
    userId: userId || null,
    createdAt: new Date().toISOString(),

    baseUrl: imageUrl,
    depthUrl: uploadedDepthUrl,
    normalUrl: uploadedNormalUrl,
    cutoutUrl: uploadedCutoutUrl,
    fxTextureUrl: uploadedFxUrl,

    // Suggested shader params (can be tuned per skin)
    shader: {
      parallaxStrength: 0.018,
      normalStrength: 1.0,
      rimStrength: 0.35,
      glareStrength: 0.8,
      // FX overlay (\"dynamic skin\" feel)
      fxStrength: 0.75,
      fxSpeed: 1.0,
      fxScale: 1.35,
    },
  };

  const metaBuf = Buffer.from(JSON.stringify(meta, null, 2), 'utf8');
  const metaUrl = await uploadToOSS(metaBuf, `${prefix}-meta.json`, 'application/json');

  return {
    jobId,
    baseUrl: imageUrl,
    depthUrl: uploadedDepthUrl,
    normalUrl: uploadedNormalUrl,
    cutoutUrl: uploadedCutoutUrl,
    metaUrl,
    meta,
  };
}

module.exports = {
  generateAvatarAssetPack,
};
