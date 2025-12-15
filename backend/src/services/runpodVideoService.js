const axios = require('axios');
const FormData = require('form-data');

/**
 * RunPod video generation client.
 *
 * Expects env:
 * - RUNPOD_VIDEO_API=https://<pod>-8000.proxy.runpod.net
 *
 * RunPod API contract (expected):
 * - POST /generate (multipart/form-data):
 *   - image: jpeg/png
 *   - motion: number
 *   - fps: number
 *   - frames: number
 *   - loop: boolean
 * - Response:
 *   { success: true, job_id, video_url } OR direct { video_url }.
 * - The returned video_url may be absolute or relative to RUNPOD_VIDEO_API.
 */

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

function resolveRunpodUrl(base, maybeRelative) {
  if (!maybeRelative) return null;
  if (maybeRelative.startsWith('http://') || maybeRelative.startsWith('https://')) return maybeRelative;
  const b = base.replace(/\/$/, '');
  const p = maybeRelative.startsWith('/') ? maybeRelative : `/${maybeRelative}`;
  return `${b}${p}`;
}

function getGeneratePath() {
  const p = process.env.RUNPOD_VIDEO_GENERATE_PATH || '/generate';
  return p.startsWith('/') ? p : `/${p}`;
}

async function downloadToBuffer(url) {
  const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 300000 });
  return Buffer.from(resp.data);
}

async function generateVideoFromImage({
  imageUrl,
  motion = 80,
  fps = 12,
  frames = 25,
  loop = true,
  // Optional: Improve identity consistency / quality (depends on RunPod API implementation)
  seed,
  steps,
  min_guidance,
  max_guidance,
  noise_aug,
}) {
  const base = requireEnv('RUNPOD_VIDEO_API');

  // Download source image (we upload bytes to RunPod)
  const imageBuf = await downloadToBuffer(imageUrl);
  if (!imageBuf || imageBuf.length < 128) {
    throw new Error(`RunPod source image too small/invalid (len=${imageBuf?.length || 0})`);
  }

  const form = new FormData();
  form.append('image', imageBuf, { filename: 'avatar.jpg', contentType: 'image/jpeg' });
  form.append('motion', String(motion));
  form.append('fps', String(fps));
  form.append('frames', String(frames));
  form.append('loop', String(loop));
  if (typeof seed === 'number' && Number.isFinite(seed) && seed > 0) form.append('seed', String(seed));
  if (typeof steps === 'number' && Number.isFinite(steps) && steps > 0) form.append('steps', String(steps));
  if (typeof min_guidance === 'number' && Number.isFinite(min_guidance)) form.append('min_guidance', String(min_guidance));
  if (typeof max_guidance === 'number' && Number.isFinite(max_guidance)) form.append('max_guidance', String(max_guidance));
  if (typeof noise_aug === 'number' && Number.isFinite(noise_aug)) form.append('noise_aug', String(noise_aug));

  const endpoint = `${base.replace(/\/$/, '')}${getGeneratePath()}`;
  const resp = await axios.post(endpoint, form, {
    headers: form.getHeaders(),
    timeout: 300000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  const videoPath = resp.data?.video_url || resp.data?.videoUrl || resp.data?.output || null;
  const jobId = resp.data?.job_id || resp.data?.jobId || resp.data?.id || null;
  const videoUrl = resolveRunpodUrl(base, videoPath);

  if (!videoUrl) {
    throw new Error(`RunPod response missing video_url (jobId=${jobId || 'n/a'})`);
  }

  return {
    jobId,
    videoUrl,
    meta: resp.data || null,
  };
}

module.exports = {
  generateVideoFromImage,
  downloadToBuffer,
};

