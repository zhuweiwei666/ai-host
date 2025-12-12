// Cheap deterministic 1D noise helpers.
// WHY: non-periodic modulation prevents obvious looping.

function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Deterministic 32-bit hash -> [0..1)
function hash01(n: number) {
  let x = (n | 0) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 4294967296;
}

/**
 * Value noise in 1D.
 * - Cheap: 2 hashes + lerp
 * - Stable: deterministic given seed
 */
export function noise1D(t: number, seed: number) {
  const i0 = Math.floor(t);
  const f = t - i0;
  const u = smoothstep(f);
  const v0 = hash01(i0 + seed * 1013);
  const v1 = hash01(i0 + 1 + seed * 1013);
  // map to [-1..1]
  return (lerp(v0, v1, u) * 2 - 1);
}

/**
 * 2-octave fBM.
 * WHY: removes the "single wobble" signature typical of 1 noise layer.
 */
export function fbm1D(t: number, seed: number) {
  const n1 = noise1D(t, seed);
  const n2 = noise1D(t * 2.07 + 19.19, seed + 17);
  return (n1 + 0.55 * n2) / 1.55;
}

/**
 * Small string hash for stable per-layer seeds.
 */
export function fnv1a32(str: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
