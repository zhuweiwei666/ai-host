import { useEffect, useMemo, useRef, useState } from 'react';

// WebGL renderer for the fal-generated asset pack.
// Input: meta.json containing baseUrl, depthUrl, normalUrl, cutoutUrl + shader params.
// Output: Apple-like "spatial photo" parallax + lighting using a single quad.

export type SpatialMeta = {
  version: number;
  jobId?: string;
  baseUrl: string;
  depthUrl: string;
  normalUrl: string;
  cutoutUrl: string;
  fxTextureUrl?: string;
  shader?: {
    parallaxStrength?: number;
    normalStrength?: number;
    rimStrength?: number;
    glareStrength?: number;
    fxStrength?: number;
    fxSpeed?: number;
    fxScale?: number;
    focusX?: number;
    focusY?: number;
    blinkStrength?: number;
  };
};

export type WebGLSpatialAvatarProps = {
  /** URL to meta.json returned by /api/avatar-assets/generate */
  metaUrl: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  interactive?: boolean;
  /** Per-agent overrides (persisted in DB). Applied on top of meta.shader. */
  shaderOverrides?: SpatialMeta['shader'];
  /** In Lab: pick face/eyes focus point (UV space). */
  onPickFocus?: (x: number, y: number) => void;
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function hash01(s: string) {
  // tiny deterministic hash -> [0,1)
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(resolveAssetUrl(url), { mode: 'cors', credentials: 'omit' });
  if (!res.ok) throw new Error(`Failed to fetch meta: ${res.status}`);
  return res.json();
}

async function loadImageBitmap(url: string): Promise<ImageBitmap> {
  const resolved = resolveAssetUrl(url);
  const res = await fetch(resolved, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) throw new Error(`Failed to fetch image (${url}): ${res.status}`);
  const blob = await res.blob();
  return createImageBitmap(blob, { premultiplyAlpha: 'premultiply' });
}

function resolveAssetUrl(url: string): string {
  // For absolute cross-origin URLs, route through same-origin proxy to avoid CORS issues.
  if (typeof window === 'undefined') return url;
  if (!url) return url;
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  try {
    const u = new URL(url, window.location.href);
    const sameOrigin = u.origin === window.location.origin;
    if (sameOrigin) return u.toString();
    return `/api/oss/proxy?url=${encodeURIComponent(u.toString())}`;
  } catch {
    return url;
  }
}

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const s = gl.createShader(type);
  if (!s) throw new Error('shader alloc failed');
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const msg = gl.getShaderInfoLog(s) || 'shader compile failed';
    gl.deleteShader(s);
    throw new Error(msg);
  }
  return s;
}

function createProgram(gl: WebGLRenderingContext, vsSrc: string, fsSrc: string) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const p = gl.createProgram();
  if (!p) throw new Error('program alloc failed');
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const msg = gl.getProgramInfoLog(p) || 'program link failed';
    gl.deleteProgram(p);
    throw new Error(msg);
  }
  return p;
}

function createTexture(gl: WebGLRenderingContext, unit: number, bitmap: ImageBitmap) {
  const tex = gl.createTexture();
  if (!tex) throw new Error('texture alloc failed');
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  // NOTE: vUv in our fullscreen quad already matches browser image orientation.
  // Flipping here will invert the image (user sees upside-down).
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
  return tex;
}

function createSolidTexture(gl: WebGLRenderingContext, unit: number, rgba: [number, number, number, number]) {
  const tex = gl.createTexture();
  if (!tex) throw new Error('texture alloc failed');
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const data = new Uint8Array(rgba);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  return tex;
}

const VS = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){
  // Flip Y in shader for consistent image orientation across decoders/CDNs.
  // WHY: avoids upside-down rendering caused by differing image origin conventions.
  vec2 uv = (aPos * 0.5) + 0.5;
  vUv = vec2(uv.x, 1.0 - uv.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

// NOTE: We keep it simple and "premium":
// - depth -> parallax uv shift
// - normal -> directional + spec highlight
// - cutout alpha -> edges + rim
const FS = `
precision mediump float;
varying vec2 vUv;

uniform sampler2D uBase;
uniform sampler2D uDepth;
uniform sampler2D uNormal;
uniform sampler2D uCutout;
uniform sampler2D uFx;

uniform vec2 uPointer;     // [-1..1]
uniform vec2 uLook;        // [-1..1] (light direction / "eye contact")
uniform vec2 uFocus;       // [0..1] (face/eyes focus point)
uniform float uBlink;      // [0..1]
uniform float uBlinkStr;   // strength
uniform float uTime;

uniform float uParallax;
uniform float uNormalStr;
uniform float uRimStr;
uniform float uGlareStr;
uniform float uFxStrength;
uniform float uFxSpeed;
uniform float uFxScale;
uniform float uExposure;

float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main(){
  // ===== Autonomous "alive" motion (non-interactive presence) =====
  // WHY: should feel alive even when user is idle.
  float b = (sin(uTime * 0.55) + 0.35 * sin(uTime * 1.31) + 0.18 * sin(uTime * 0.17)) / (1.0 + 0.35 + 0.18); // [-1..1]
  vec2 uv0 = vUv;
  vec2 c = vec2(0.5, 0.5);
  // subtle breathing: tiny zoom + lift
  uv0 = (uv0 - c) * (1.0 - b * 0.010) + c + vec2(0.0, b * 0.004);

  // Micro-expression: blink around focus point (requires focus calibration for best results)
  float alpha0 = texture2D(uCutout, uv0).a;
  vec2 df = (uv0 - uFocus) / vec2(0.09, 0.06); // ellipse around eyes/face center
  float focusM = exp(-dot(df, df) * 1.6);
  float blink = uBlink * uBlinkStr * focusM * smoothstep(0.25, 0.9, alpha0);
  uv0.y = uFocus.y + (uv0.y - uFocus.y) * (1.0 - blink * 0.28);

  // depth assumed grayscale; fallback to luma
  float d = luma(texture2D(uDepth, uv0).rgb);
  // center depth around 0.5 for stability
  float depth = (d - 0.5);

  // Micro depth wobble driven by FX noise (very small; removes "static poster" feel)
  float wob = luma(texture2D(uFx, uv0 * 0.75 + vec2(uTime * 0.02, -uTime * 0.015)).rgb) - 0.5;
  vec2 wobVec = vec2(wob, -wob) * 0.0022 * clamp(depth * 2.0, -1.0, 1.0);

  // Parallax: closer pixels move more (depth>0)
  vec2 uv = uv0 + (uPointer * uParallax) * depth + wobVec;

  vec4 base = texture2D(uBase, uv);
  vec4 cut = texture2D(uCutout, uv);
  float alpha = cut.a; // subject alpha

  // Normal map in [0..1] -> [-1..1]
  vec3 n = texture2D(uNormal, uv).rgb * 2.0 - 1.0;
  n = normalize(mix(vec3(0.0,0.0,1.0), n, uNormalStr));

  // Lighting direction follows uLook ("eye contact" / focus)
  vec3 l = normalize(vec3(uLook.x * 0.9, -uLook.y * 0.9, 1.0));
  float ndl = clamp(dot(n, l), 0.0, 1.0);

  // Soft specular
  vec3 h = normalize(l + vec3(0.0, 0.0, 1.0));
  float spec = pow(clamp(dot(n, h), 0.0, 1.0), 28.0) * (uGlareStr * 0.55);
  spec *= (1.0 - blink * 0.85);

  // Rim light from alpha edge + normal
  float edge = smoothstep(0.4, 0.98, alpha) - smoothstep(0.98, 1.0, alpha);
  float rim = pow(1.0 - ndl, 2.0) * uRimStr;

  vec3 col = base.rgb;
  // Keep base contrast; avoid "gray veil" look.
  col *= (0.98 + 0.22 * ndl);
  col += spec * vec3(1.0, 1.0, 1.0);
  col += rim * vec3(1.0, 0.95, 0.90) * edge;
  col *= (1.0 - blink * 0.10);

  // ===== Dynamic Skin FX Overlay (energy / particles / flares) =====
  // WHY: brings \"王者荣耀动态皮肤\" vibe without video assets.
  vec2 fxUv = uv * uFxScale + vec2(uTime * 0.10 * uFxSpeed, uTime * 0.06 * uFxSpeed) + uPointer * 0.025;
  float nfx = luma(texture2D(uFx, fxUv).rgb);
  float streak = smoothstep(0.62, 0.95, nfx);
  float sparkle = smoothstep(0.92, 1.0, nfx) * (0.5 + 0.5 * sin(uTime * 18.0 + nfx * 12.0));
  float fxMask = alpha * (0.20 + 0.80 * edge); // mostly near edges
  // add depth bias so closer regions catch more energy
  fxMask *= (0.75 + 0.5 * clamp(depth + 0.15, 0.0, 1.0));
  float fx = (0.55 * streak + 0.45 * sparkle) * uFxStrength * fxMask;
  fx *= (1.0 - blink * 0.65);

  vec3 fxCol = mix(vec3(0.25, 0.75, 1.0), vec3(0.90, 0.35, 1.0), 0.5 + 0.5 * sin(uTime * 0.7));
  // Screen blend
  col = 1.0 - (1.0 - col) * (1.0 - fxCol * (fx * 0.65));

  // NOTE: Avoid background desat/dim here.
  // WHY: some cutout alphas are soft across the whole subject, which can cause a "gray overlay" feeling.

  // Soft vignette to reduce "flat cutout" feel
  float vig = smoothstep(0.95, 0.35, length(uv0 - c));
  col *= mix(0.92, 1.03, vig);

  // Tone-map + gamma to avoid blowout on bright portraits.
  col = vec3(1.0) - exp(-col * max(0.35, uExposure));
  col = pow(col, vec3(1.0 / 2.2));
  // Tiny contrast to keep the image from looking washed.
  col = clamp((col - 0.5) * 1.06 + 0.5, 0.0, 1.0);

  gl_FragColor = vec4(col, 1.0);
}
`;

export default function WebGLSpatialAvatar({
  metaUrl,
  width = 220,
  height = 220,
  className,
  interactive = true,
  shaderOverrides,
  onPickFocus,
}: WebGLSpatialAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shaderOverridesRef = useRef<SpatialMeta['shader'] | undefined>(undefined);
  const shaderBaseRef = useRef<SpatialMeta['shader'] | undefined>(undefined);
  const seedRef = useRef<number>(0.123);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const pointerTarget = useRef({ x: 0, y: 0, inside: false, lastMoveT: 0 });
  const pointer = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const look = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const blinkRef = useRef({ nextT: 0, startT: -1, dur: 0.12, phase: 0, value: 0, r: 12345 });

  // Update overrides without reloading textures/shaders.
  useEffect(() => {
    shaderOverridesRef.current = shaderOverrides;
  }, [shaderOverrides]);

  useEffect(() => {
    let destroyed = false;
    let raf: number | null = null;

    (async () => {
      setError(null);
      const canvas = canvasRef.current;
      if (!canvas) return;

      const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true });
      if (!gl) {
        setError('WebGL not supported');
        return;
      }

      try {
        const meta = await fetchJson<SpatialMeta>(metaUrl);
        shaderBaseRef.current = meta.shader;
        seedRef.current = hash01(meta.jobId || metaUrl) * 1000;
        const [baseBmp, depthBmp, normalBmp, cutBmp, fxBmp] = await Promise.all([
          loadImageBitmap(meta.baseUrl),
          loadImageBitmap(meta.depthUrl),
          loadImageBitmap(meta.normalUrl),
          loadImageBitmap(meta.cutoutUrl),
          meta.fxTextureUrl ? loadImageBitmap(meta.fxTextureUrl) : Promise.resolve(null as any),
        ]);

        if (destroyed) return;

        const program = createProgram(gl, VS, FS);
        gl.useProgram(program);

        // Fullscreen quad
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
          gl.STATIC_DRAW,
        );
        const aPos = gl.getAttribLocation(program, 'aPos');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        // Textures
        createTexture(gl, 0, baseBmp);
        gl.uniform1i(gl.getUniformLocation(program, 'uBase'), 0);
        createTexture(gl, 1, depthBmp);
        gl.uniform1i(gl.getUniformLocation(program, 'uDepth'), 1);
        createTexture(gl, 2, normalBmp);
        gl.uniform1i(gl.getUniformLocation(program, 'uNormal'), 2);
        createTexture(gl, 3, cutBmp);
        gl.uniform1i(gl.getUniformLocation(program, 'uCutout'), 3);

        // FX texture (or fallback black)
        if (meta.fxTextureUrl && fxBmp) {
          createTexture(gl, 4, fxBmp);
        } else {
          createSolidTexture(gl, 4, [0, 0, 0, 255]);
        }
        gl.uniform1i(gl.getUniformLocation(program, 'uFx'), 4);

        const uPointer = gl.getUniformLocation(program, 'uPointer');
        const uLook = gl.getUniformLocation(program, 'uLook');
        const uFocus = gl.getUniformLocation(program, 'uFocus');
        const uBlink = gl.getUniformLocation(program, 'uBlink');
        const uBlinkStr = gl.getUniformLocation(program, 'uBlinkStr');
        const uTime = gl.getUniformLocation(program, 'uTime');
        const uParallax = gl.getUniformLocation(program, 'uParallax');
        const uNormalStr = gl.getUniformLocation(program, 'uNormalStr');
        const uRimStr = gl.getUniformLocation(program, 'uRimStr');
        const uGlareStr = gl.getUniformLocation(program, 'uGlareStr');
        const uFxStrength = gl.getUniformLocation(program, 'uFxStrength');
        const uFxSpeed = gl.getUniformLocation(program, 'uFxSpeed');
        const uFxScale = gl.getUniformLocation(program, 'uFxScale');
        const uExposure = gl.getUniformLocation(program, 'uExposure');

        const applyShaderUniforms = () => {
          // defaults -> meta.shader -> overrides
          const base = shaderBaseRef.current || {};
          const ov = shaderOverridesRef.current || {};
          const parallax = ov.parallaxStrength ?? base.parallaxStrength ?? 0.018;
          const normalStr = ov.normalStrength ?? base.normalStrength ?? 1.0;
          const rimStr = ov.rimStrength ?? base.rimStrength ?? 0.35;
          const glareStr = ov.glareStrength ?? base.glareStrength ?? 0.8;
          const fxStrength = ov.fxStrength ?? base.fxStrength ?? 0.0;
          const fxSpeed = ov.fxSpeed ?? base.fxSpeed ?? 1.0;
          const fxScale = ov.fxScale ?? base.fxScale ?? 1.2;
          const exposure = (ov as any).exposure ?? (base as any).exposure ?? 1.0;
          const focusX = clamp(ov.focusX ?? base.focusX ?? 0.5, 0, 1);
          const focusY = clamp(ov.focusY ?? base.focusY ?? 0.70, 0, 1);
          const blinkStr = clamp(ov.blinkStrength ?? base.blinkStrength ?? 0.85, 0, 1.5);

          gl.uniform1f(uParallax, parallax);
          gl.uniform1f(uNormalStr, normalStr);
          gl.uniform1f(uRimStr, rimStr);
          gl.uniform1f(uGlareStr, glareStr);
          gl.uniform1f(uFxStrength, fxStrength);
          gl.uniform1f(uFxSpeed, fxSpeed);
          gl.uniform1f(uFxScale, fxScale);
          gl.uniform1f(uExposure, exposure);
          gl.uniform2f(uFocus, focusX, focusY);
          gl.uniform1f(uBlinkStr, blinkStr);
        };

        const resize = () => {
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          const w = canvas.clientWidth;
          const h = canvas.clientHeight;
          canvas.width = Math.floor(w * dpr);
          canvas.height = Math.floor(h * dpr);
          gl.viewport(0, 0, canvas.width, canvas.height);
        };

        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(canvas);

        let t0: number | null = null;
        let last: number | null = null;

        const tick = (nowMs: number) => {
          if (destroyed) return;
          const now = nowMs / 1000;
          t0 ??= now;
          const dt = clamp(now - (last ?? now), 0, 0.05);
          last = now;

          // Idle return
          const idleFor = now - pointerTarget.current.lastMoveT;
          const wantsReturn = !pointerTarget.current.inside || idleFor > 0.8;
          const s = seedRef.current;
          // Autonomous drift: non-obvious, slow, clamped
          const autoX = 0.085 * Math.sin(now * (0.24 + (s % 7) * 0.01) + s) + 0.030 * Math.sin(now * 0.97 + s * 1.7);
          const autoY = 0.060 * Math.sin(now * (0.19 + (s % 5) * 0.01) + s * 0.7) + 0.020 * Math.sin(now * 1.33 + s * 2.1);
          const autoW = wantsReturn ? 1 : 0.25; // when user interacts, keep auto subtle
          const tx = (wantsReturn ? 0 : pointerTarget.current.x) + autoX * autoW;
          const ty = (wantsReturn ? 0 : pointerTarget.current.y) + autoY * autoW;

          // Spring smoothing
          const stiffness = 46;
          const damping = 2 * Math.sqrt(stiffness) * 1.1;
          const ax = (tx - pointer.current.x) * stiffness - pointer.current.vx * damping;
          const ay = (ty - pointer.current.y) * stiffness - pointer.current.vy * damping;
          pointer.current.vx += ax * dt;
          pointer.current.vy += ay * dt;
          pointer.current.x += pointer.current.vx * dt;
          pointer.current.y += pointer.current.vy * dt;

          // "Look-at" / focus: slow scan when idle, quick lock when user moves.
          const scanX = 0.22 * Math.sin(now * 0.22 + s * 1.11) + 0.10 * Math.sin(now * 0.63 + s * 0.37);
          const scanY = 0.16 * Math.sin(now * 0.18 + s * 0.77) + 0.08 * Math.sin(now * 0.52 + s * 0.91);
          const lock = pointerTarget.current.inside && idleFor < 1.2 ? 1 : 0;
          const ltx = lock ? pointerTarget.current.x : scanX;
          const lty = lock ? pointerTarget.current.y : scanY;

          const lookStiff = 70;
          const lookDamp = 2 * Math.sqrt(lookStiff) * 1.12;
          const lax = (ltx - look.current.x) * lookStiff - look.current.vx * lookDamp;
          const lay = (lty - look.current.y) * lookStiff - look.current.vy * lookDamp;
          look.current.vx += lax * dt;
          look.current.vy += lay * dt;
          look.current.x += look.current.vx * dt;
          look.current.y += look.current.vy * dt;

          const rm = prefersReducedMotion ? 0.15 : 1;
          const px = clamp(pointer.current.x * rm, -1, 1);
          const py = clamp(pointer.current.y * rm, -1, 1);
          const lx = clamp(look.current.x * rm, -1, 1);
          const ly = clamp(look.current.y * rm, -1, 1);

          // Blink events: randomized, quick, not perfectly periodic.
          const br = blinkRef.current;
          if (!br.nextT) {
            br.r = Math.floor(seedRef.current * 1e6) ^ 0x9e3779b9;
            br.nextT = now + 2.2 + (br.r % 1000) / 1000 * 2.8;
          }
          if (now >= br.nextT && br.startT < 0) {
            br.startT = now;
            br.dur = 0.11 + ((br.r >>> 8) % 1000) / 1000 * 0.05;
            // LCG-ish
            br.r = (br.r * 1664525 + 1013904223) >>> 0;
            br.nextT = now + 2.4 + (br.r % 1000) / 1000 * 3.2;
          }
          let blinkV = 0;
          if (br.startT >= 0) {
            const p = (now - br.startT) / br.dur;
            if (p >= 1) {
              br.startT = -1;
            } else {
              const s1 = Math.sin(Math.PI * clamp(p, 0, 1));
              blinkV = s1 * s1; // smooth close/open
            }
          }

          // Apply shader uniforms every frame so Lab sliders feel instant.
          applyShaderUniforms();
          gl.uniform2f(uPointer, px, py);
          gl.uniform2f(uLook, lx, ly);
          gl.uniform1f(uBlink, prefersReducedMotion ? 0 : blinkV);
          gl.uniform1f(uTime, now - t0);

          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.drawArrays(gl.TRIANGLES, 0, 6);

          raf = window.requestAnimationFrame(tick);
        };

        raf = window.requestAnimationFrame(tick);

        return () => {
          ro.disconnect();
        };
      } catch (e: any) {
        setError(e?.message || 'WebGL init failed');
      }
    })();

    return () => {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [metaUrl, prefersReducedMotion]);

  return (
    <div
      className={['relative overflow-hidden rounded-2xl bg-gray-100', className].filter(Boolean).join(' ')}
      style={{ width, height }}
      onPointerMove={(e) => {
        if (!interactive) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const r = canvas.getBoundingClientRect();
        const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
        const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
        pointerTarget.current.x = clamp(nx, -1, 1);
        pointerTarget.current.y = clamp(ny, -1, 1);
        pointerTarget.current.inside = true;
        pointerTarget.current.lastMoveT = performance.now() / 1000;
      }}
      onPointerEnter={() => {
        pointerTarget.current.inside = true;
      }}
      onPointerLeave={() => {
        pointerTarget.current.inside = false;
      }}
      onDoubleClick={(e) => {
        if (!onPickFocus) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const r = canvas.getBoundingClientRect();
        const x = clamp((e.clientX - r.left) / r.width, 0, 1);
        const y = clamp((e.clientY - r.top) / r.height, 0, 1);
        // vUv is flipped in shader, so focusY should also be flipped.
        onPickFocus(x, 1 - y);
      }}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-red-600 bg-white/70">
          {error}
        </div>
      )}
    </div>
  );
}
