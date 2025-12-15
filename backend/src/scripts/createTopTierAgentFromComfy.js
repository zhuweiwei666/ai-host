/**
 * Create a brand-new "top-tier" realistic AI agent by:
 * 1) generating persona images (closeup + halfbody) via ComfyUI
 * 2) generating 20 short clips (closeup/halfbody + idle/talk/react_*) via AnimateDiff SDXL + FaceID lock
 * 3) downloading outputs -> transcoding to iOS-friendly vertical -> uploading to R2
 * 4) creating Agent in MongoDB with avatarUrls + previewVideos
 *
 * Run inside backend container:
 *   node src/scripts/createTopTierAgentFromComfy.js
 *
 * Optional env overrides:
 *   COMFY_URL=https://<pod>-8188.proxy.runpod.net
 *   POD_API_URL=https://<pod>-8000.proxy.runpod.net
 *   AGENT_NAME="Aurora"
 */

const crypto = require('crypto');
const FormData = require('form-data');
const axios = require('axios');

const connectDB = require('../config/db');
const Agent = require('../models/Agent');
const { uploadBufferToR2 } = require('../services/r2Client');
const { transcodeForIOS } = require('../services/liveSkinService');

const DEFAULT_COMFY_URL = 'https://jblmtfkcuk6q96-8188.proxy.runpod.net';
const DEFAULT_POD_API_URL = 'https://jblmtfkcuk6q96-8000.proxy.runpod.net';

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

function requireEnvOr(name, fallback) {
  return process.env[name] || fallback;
}

function comfyViewUrl(comfy, file) {
  const base = comfy.replace(/\/$/, '');
  const filename = encodeURIComponent(file.filename);
  const subfolder = encodeURIComponent(file.subfolder || '');
  const type = encodeURIComponent(file.type || 'output');
  return `${base}/view?filename=${filename}&subfolder=${subfolder}&type=${type}`;
}

async function httpGetBuffer(url) {
  const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 300000 });
  return Buffer.from(resp.data);
}

async function queueComfyPrompt(podApiUrl, prompt) {
  const endpoint = `${podApiUrl.replace(/\/$/, '')}/comfy/queue`;
  const resp = await axios.post(endpoint, { prompt }, { timeout: 30000 });
  return resp.data?.prompt_id;
}

async function pollComfyHistory(comfyUrl, promptId, { timeoutMs = 600000, pollMs = 1200 } = {}) {
  const base = comfyUrl.replace(/\/$/, '');
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const r = await axios.get(`${base}/history/${promptId}`, { timeout: 30000 });
    const entry = r.data?.[promptId];
    if (entry?.outputs) return entry;
    await new Promise((res) => setTimeout(res, pollMs));
  }
  throw new Error(`ComfyUI timeout waiting history for ${promptId}`);
}

async function uploadImageToComfyInput(comfyUrl, { filename, buffer, subfolder }) {
  const base = comfyUrl.replace(/\/$/, '');
  const form = new FormData();
  form.append('image', buffer, { filename, contentType: 'image/png' });
  form.append('type', 'input');
  form.append('overwrite', '1');
  if (subfolder) form.append('subfolder', subfolder);

  const resp = await axios.post(`${base}/upload/image`, form, {
    headers: form.getHeaders(),
    timeout: 300000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: () => true,
  });

  // Some proxies return 404 on HEAD, but POST should work when ComfyUI is reachable.
  if (resp.status < 200 || resp.status >= 300) {
    throw new Error(`Comfy upload failed: ${resp.status} ${String(resp.data).slice(0, 300)}`);
  }

  // response typically: { name, subfolder, type }
  return resp.data;
}

function buildPersonaPrompt({ prefix, seed, width, height, variant = 'closeup' }) {
  const W = width;
  const H = height;
  const textL =
    variant === 'halfbody'
      ? 'a beautiful realistic woman, 22 years old, gentle smile, long dark hair, minimal makeup, white blouse, half-body portrait, upper body visible, looking at camera'
      : 'a beautiful realistic woman, 22 years old, gentle smile, long dark hair, minimal makeup, white blouse, close-up, looking at camera';
  return {
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'sd_xl_base_1.0.safetensors' } },
    '2': {
      class_type: 'CLIPTextEncodeSDXL',
      inputs: {
        clip: ['1', 1],
        width: W,
        height: H,
        crop_w: 0,
        crop_h: 0,
        target_width: W,
        target_height: H,
        text_g:
          'ultra realistic portrait photo, cinematic soft light, detailed skin, natural pores, 35mm photography, shallow depth of field, professional color grading',
        text_l: textL,
      },
    },
    '3': {
      class_type: 'CLIPTextEncodeSDXL',
      inputs: {
        clip: ['1', 1],
        width: W,
        height: H,
        crop_w: 0,
        crop_h: 0,
        target_width: W,
        target_height: H,
        text_g: 'lowres, blurry, jpeg artifacts, deformed, bad anatomy, extra fingers, mutated hands, watermark, text, logo',
        text_l: 'cartoon, anime, CGI, plastic skin, uncanny',
      },
    },
    '4': { class_type: 'EmptyLatentImage', inputs: { width: W, height: H, batch_size: 1 } },
    '5': {
      class_type: 'KSampler',
      inputs: {
        model: ['1', 0],
        seed,
        steps: 28,
        cfg: 5.5,
        sampler_name: 'dpmpp_sde_gpu',
        scheduler: 'karras',
        positive: ['2', 0],
        negative: ['3', 0],
        latent_image: ['4', 0],
        denoise: 1.0,
      },
    },
    '6': { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
    '7': { class_type: 'SaveImage', inputs: { images: ['6', 0], filename_prefix: prefix } },
  };
}

function buildVideoPrompt({
  prefix,
  seed,
  width,
  height,
  frames,
  denoise,
  shot,
  actionPrompt,
  pingpong,
}) {
  const W = width;
  const H = height;

  const baseIdentityG =
    'ultra realistic portrait video, cinematic soft light, detailed skin, natural pores, 35mm photography, shallow depth of field, professional color grading, stable identity';
  const baseIdentityL = 'a beautiful realistic woman, 22 years old, long dark hair, minimal makeup, white blouse';

  const stillPosG = `${baseIdentityG}, ${shot}, neutral calm expression, looking at camera`;
  const stillPosL = `${baseIdentityL}, ${shot}, neutral calm expression, looking at camera`;

  const videoPosG = `${baseIdentityG}, ${shot}, ${actionPrompt}`;
  const videoPosL = `${baseIdentityL}, ${shot}, ${actionPrompt}`;
  const negG = 'lowres, blurry, deformation, warping, face drift, flicker, jitter, artifacts, text, watermark';
  const negL = 'cartoon, anime, CGI, plastic skin, uncanny';

  return {
    // Base SDXL
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'sd_xl_base_1.0.safetensors' } },
    // Add motion to model (AnimateDiff)
    '2': {
      class_type: 'ADE_AnimateDiffLoaderGen1',
      inputs: { model: ['1', 0], model_name: 'mm_sdxl_v10_beta.ckpt', beta_schedule: 'linear (AnimateDiff-SDXL)' },
    },
    // still prompts (identity anchor)
    '3': {
      class_type: 'CLIPTextEncodeSDXL',
      inputs: { clip: ['1', 1], width: W, height: H, crop_w: 0, crop_h: 0, target_width: W, target_height: H, text_g: stillPosG, text_l: stillPosL },
    },
    '4': {
      class_type: 'CLIPTextEncodeSDXL',
      inputs: { clip: ['1', 1], width: W, height: H, crop_w: 0, crop_h: 0, target_width: W, target_height: H, text_g: negG, text_l: negL },
    },
    // Base latent (single frame) then duplicate to batch
    '5': { class_type: 'EmptyLatentImage', inputs: { width: W, height: H, batch_size: 1 } },
    '6': {
      class_type: 'KSampler',
      inputs: {
        model: ['1', 0],
        // Keep identity stable across all clips by keeping this constant per shot type.
        seed: shot === 'halfbody' ? 2468022 : 1357911,
        steps: 26,
        cfg: 5.0,
        sampler_name: 'dpmpp_sde_gpu',
        scheduler: 'karras',
        positive: ['3', 0],
        negative: ['4', 0],
        latent_image: ['5', 0],
        denoise: 1.0,
      },
    },
    '7': { class_type: 'VHS_DuplicateLatents', inputs: { latents: ['6', 0], multiply_by: frames } },
    // video prompts (action)
    '8': {
      class_type: 'CLIPTextEncodeSDXL',
      inputs: { clip: ['1', 1], width: W, height: H, crop_w: 0, crop_h: 0, target_width: W, target_height: H, text_g: videoPosG, text_l: videoPosL },
    },
    '9': {
      class_type: 'CLIPTextEncodeSDXL',
      inputs: { clip: ['1', 1], width: W, height: H, crop_w: 0, crop_h: 0, target_width: W, target_height: H, text_g: negG, text_l: negL },
    },
    // Video sampling on duplicated latents (img2video-ish)
    '10': {
      class_type: 'KSampler',
      inputs: {
        model: ['2', 0],
        seed,
        steps: 18,
        cfg: 4.6,
        sampler_name: 'dpmpp_sde_gpu',
        scheduler: 'karras',
        positive: ['8', 0],
        negative: ['9', 0],
        latent_image: ['7', 0],
        denoise,
      },
    },
    '11': { class_type: 'VHS_VAEDecodeBatched', inputs: { samples: ['10', 0], vae: ['1', 2], per_batch: frames } },
    '12': {
      class_type: 'VHS_VideoCombine',
      inputs: {
        images: ['11', 0],
        frame_rate: 12,
        loop_count: 0,
        filename_prefix: prefix,
        format: 'video/h264-mp4',
        pix_fmt: 'yuv420p',
        crf: 18,
        save_metadata: true,
        trim_to_audio: false,
        pingpong: !!pingpong,
        save_output: true,
      },
    },
  };
}

async function main() {
  const comfyUrl = requireEnvOr('COMFY_URL', DEFAULT_COMFY_URL);
  const podApiUrl = requireEnvOr('POD_API_URL', DEFAULT_POD_API_URL);
  const agentName = process.env.AGENT_NAME || 'Aurora (TopTier Demo)';

  console.log('[TopTierAgent] starting', { comfyUrl, podApiUrl, agentName });
  await connectDB();

  const tmpAgentDoc = new Agent();
  const agentIdObj = tmpAgentDoc._id;
  const agentId = agentIdObj.toString();
  const agentFolder = `liveskin_agent_${agentId}`;

  // 1) Generate persona images
  const W = 832;
  const H = 1216;
  const closeupPrefix = `liveskin/${agentFolder}/persona_closeup`;
  const halfbodyPrefix = `liveskin/${agentFolder}/persona_halfbody`;

  const personaCloseupId = await queueComfyPrompt(
    podApiUrl,
    buildPersonaPrompt({ prefix: closeupPrefix, seed: 1357911, width: W, height: H, variant: 'closeup' })
  );
  const personaHalfId = await queueComfyPrompt(
    podApiUrl,
    buildPersonaPrompt({ prefix: halfbodyPrefix, seed: 2468022, width: W, height: H, variant: 'halfbody' })
  );

  const closeHist = await pollComfyHistory(comfyUrl, personaCloseupId, { timeoutMs: 600000 });
  const halfHist = await pollComfyHistory(comfyUrl, personaHalfId, { timeoutMs: 600000 });

  const pickOneImage = (hist) => {
    for (const nodeId of Object.keys(hist.outputs || {})) {
      const imgs = hist.outputs?.[nodeId]?.images;
      if (Array.isArray(imgs) && imgs.length) return imgs[0];
    }
    return null;
  };

  const closeFile = pickOneImage(closeHist);
  const halfFile = pickOneImage(halfHist);
  if (!closeFile || !halfFile) throw new Error('Failed to get persona images from Comfy outputs');

  const closeBuf = await httpGetBuffer(comfyViewUrl(comfyUrl, closeFile));
  const halfBuf = await httpGetBuffer(comfyViewUrl(comfyUrl, halfFile));

  // Upload persona images to R2 (for app)
  const closeKey = `agents/${todayPrefix()}/${agentId}/avatar_closeup-${crypto.randomUUID()}.png`;
  const halfKey = `agents/${todayPrefix()}/${agentId}/avatar_halfbody-${crypto.randomUUID()}.png`;
  const upClose = await uploadBufferToR2(closeBuf, closeKey, 'image/png');
  const upHalf = await uploadBufferToR2(halfBuf, halfKey, 'image/png');

  // 2) Generate 20 clips
  const FRAMES = 16;
  const denoise = 0.65;

  const clipSpecs = [
    // idle (4)
    { tag: 'idle_1', shot: 'closeup', action: 'calm subtle breathing, minimal motion, slight blink', pingpong: true, extraTags: ['idle', 'loopable', 'closeup'] },
    { tag: 'idle_2', shot: 'halfbody', action: 'calm subtle breathing, minimal motion, slight blink', pingpong: true, extraTags: ['idle', 'loopable', 'halfbody'] },
    { tag: 'idle_3', shot: 'closeup', action: 'gentle micro-smile, minimal motion, slight blink', pingpong: true, extraTags: ['idle', 'loopable', 'closeup'] },
    { tag: 'idle_4', shot: 'halfbody', action: 'gentle micro-smile, minimal motion, slight blink', pingpong: true, extraTags: ['idle', 'loopable', 'halfbody'] },
    // talk (4)
    { tag: 'talk_1', shot: 'closeup', action: 'speaking softly, subtle lip movement, gentle head nods', pingpong: false, extraTags: ['talk', 'closeup'] },
    { tag: 'talk_2', shot: 'halfbody', action: 'speaking softly, subtle lip movement, gentle head nods', pingpong: false, extraTags: ['talk', 'halfbody'] },
    { tag: 'talk_3', shot: 'closeup', action: 'speaking with emphasis, subtle eyebrow movement', pingpong: false, extraTags: ['talk', 'closeup'] },
    { tag: 'talk_4', shot: 'halfbody', action: 'speaking with emphasis, subtle eyebrow movement', pingpong: false, extraTags: ['talk', 'halfbody'] },
    // react (12)
    { tag: 'react_happy_c', shot: 'closeup', action: 'happy reaction, warm smile, bright eyes', pingpong: false, extraTags: ['react_happy', 'closeup'] },
    { tag: 'react_happy_h', shot: 'halfbody', action: 'happy reaction, warm smile, bright eyes', pingpong: false, extraTags: ['react_happy', 'halfbody'] },
    { tag: 'react_shy_c', shot: 'closeup', action: 'shy reaction, slight blush, look away briefly', pingpong: false, extraTags: ['react_shy', 'closeup'] },
    { tag: 'react_shy_h', shot: 'halfbody', action: 'shy reaction, slight blush, look away briefly', pingpong: false, extraTags: ['react_shy', 'halfbody'] },
    { tag: 'react_flirty_c', shot: 'closeup', action: 'flirty reaction, playful smile, subtle wink', pingpong: false, extraTags: ['react_flirty', 'closeup'] },
    { tag: 'react_flirty_h', shot: 'halfbody', action: 'flirty reaction, playful smile, subtle wink', pingpong: false, extraTags: ['react_flirty', 'halfbody'] },
    { tag: 'react_sad_c', shot: 'closeup', action: 'sad reaction, soft eyes, slight downturned lips', pingpong: false, extraTags: ['react_sad', 'closeup'] },
    { tag: 'react_sad_h', shot: 'halfbody', action: 'sad reaction, soft eyes, slight downturned lips', pingpong: false, extraTags: ['react_sad', 'halfbody'] },
    { tag: 'react_angry_c', shot: 'closeup', action: 'angry reaction, furrowed brows, tense expression', pingpong: false, extraTags: ['react_angry', 'closeup'] },
    { tag: 'react_angry_h', shot: 'halfbody', action: 'angry reaction, furrowed brows, tense expression', pingpong: false, extraTags: ['react_angry', 'halfbody'] },
    { tag: 'react_surprised_c', shot: 'closeup', action: 'surprised reaction, widened eyes, slight gasp', pingpong: false, extraTags: ['react_surprised', 'closeup'] },
    { tag: 'react_surprised_h', shot: 'halfbody', action: 'surprised reaction, widened eyes, slight gasp', pingpong: false, extraTags: ['react_surprised', 'halfbody'] },
  ];
  const clipLimit = Number(process.env.CLIP_LIMIT || 0);
  const runSpecs = clipLimit > 0 ? clipSpecs.slice(0, clipLimit) : clipSpecs;

  const videos = [];
  let sortOrder = 0;
  for (const spec of runSpecs) {
    const prefix = `liveskin/${agentFolder}/${spec.tag}`;
    const seed = 100000 + sortOrder * 9973;

    console.log('[TopTierAgent] generating', spec.tag);
    const promptId = await queueComfyPrompt(
      podApiUrl,
      buildVideoPrompt({
        prefix,
        seed,
        width: W,
        height: H,
        frames: FRAMES,
        denoise,
        shot: spec.shot,
        actionPrompt: spec.action,
        pingpong: spec.pingpong,
      })
    );
    console.log('[TopTierAgent] promptId', spec.tag, promptId);

    const hist = await pollComfyHistory(comfyUrl, promptId, { timeoutMs: 900000, pollMs: 2000 });

    const findFirstMp4 = (outputs) => {
      if (!outputs || typeof outputs !== 'object') return null;
      for (const nodeId of Object.keys(outputs)) {
        const nodeOut = outputs[nodeId];
        if (!nodeOut || typeof nodeOut !== 'object') continue;
        for (const k of Object.keys(nodeOut)) {
          const arr = nodeOut[k];
          if (!Array.isArray(arr)) continue;
          for (const item of arr) {
            if (item && typeof item === 'object' && typeof item.filename === 'string' && item.filename.toLowerCase().endsWith('.mp4')) {
              return item;
            }
          }
        }
      }
      return null;
    };

    const videoFile = findFirstMp4(hist.outputs);
    if (!videoFile) {
      const out = hist.outputs || {};
      const summary = {};
      for (const nodeId of Object.keys(out)) summary[nodeId] = Object.keys(out[nodeId] || {});
      console.error('[TopTierAgent] No mp4 found. status:', hist.status);
      console.error('[TopTierAgent] outputs keys by node:', summary);
      throw new Error(`No video output for ${spec.tag}`);
    }

    const rawVideo = await httpGetBuffer(comfyViewUrl(comfyUrl, videoFile));
    const finalVideo = await transcodeForIOS({ inputBuffer: rawVideo, targetW: 1080, targetH: 1920 });

    const key = `liveskin/top/${todayPrefix()}/${agentId}/${spec.tag}-${crypto.randomUUID()}.mp4`;
    const up = await uploadBufferToR2(finalVideo, key, 'video/mp4');

    const entry = {
      url: up.url,
      thumbnailUrl: upClose.url,
      duration: FRAMES / 12,
      width: 1080,
      height: 1920,
      fileSize: finalVideo.length,
      format: 'mp4',
      isVertical: true,
      sortOrder,
      tags: ['gen', 'source'].concat(ensureArray(spec.extraTags)),
      scaleLevel: 1,
    };
    videos.push(entry);
    sortOrder += 1;
  }

  // 3) Create agent record
  const agent = await Agent.create({
    _id: agentIdObj,
    name: agentName,
    style: 'realistic',
    gender: 'female',
    avatarUrls: [upClose.url, upHalf.url],
    avatarUrl: upClose.url,
    // Admin "主播相册" uses coverVideoUrls; keep in sync for visibility.
    coverVideoUrls: videos.map((v) => v.url),
    coverVideoUrl: videos[0]?.url || '',
    previewVideos: videos,
    defaultPreviewIndex: 0,
    liveSkinStatus: 'ready',
    liveSkinGeneratedAt: new Date(),
    liveSkinLastError: '',
    description: 'Top-tier generated demo agent (realistic).',
  });

  console.log('[TopTierAgent] CREATED', { agentId: agent._id.toString(), name: agent.name, videos: videos.length });
  process.exit(0);
}

main().catch((e) => {
  console.error('[TopTierAgent] fatal', e);
  process.exit(1);
});

