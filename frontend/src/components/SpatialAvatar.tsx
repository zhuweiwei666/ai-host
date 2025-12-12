import React, { useEffect, useMemo, useRef, useState } from 'react';
import './SpatialAvatar.css';
import { fbm1D, fnv1a32 } from './noise';
import { DEFAULT_MOTION_PROFILE, type MotionProfile } from './motionProfile';

export type Rect01 = { x: number; y: number; w: number; h: number };

export type SpatialAvatarLayer = {
  id: string;
  /** Normalized [0..1] rect within the PNG (same coordinate system as the rendered container). */
  rect: Rect01;
  /** Depth scalar. Higher = closer to camera (moves more with parallax). */
  z: number;
  className?: string;
  /** Optional axis weights (spec: different layers must NOT move in sync). */
  axis?: { x?: number; y?: number };
  /** Optional breathing influence (0..1). Torso usually higher than face. */
  breath?: number;
};

export const DEFAULT_PORTRAIT_LAYERS: SpatialAvatarLayer[] = [
  // bg: slightly behind (negative z) => moves opposite for depth illusion
  { id: 'bg', rect: { x: 0, y: 0, w: 1, h: 1 }, z: -0.2 },
  // body: carries most breathing
  { id: 'body', rect: { x: 0.06, y: 0.32, w: 0.88, h: 0.68 }, z: 0.2 },
  // face: closer
  { id: 'face', rect: { x: 0.16, y: 0.06, w: 0.68, h: 0.46 }, z: 0.6 },
  // Optional: eyes/mouth layer could go here with z: 0.9
];

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function fract(x: number) {
  return x - Math.floor(x);
}

function rectToInset(rect: Rect01) {
  const x = clamp(rect.x, 0, 1);
  const y = clamp(rect.y, 0, 1);
  const w = clamp(rect.w, 0, 1);
  const h = clamp(rect.h, 0, 1);
  const top = y * 100;
  const left = x * 100;
  const right = (1 - (x + w)) * 100;
  const bottom = (1 - (y + h)) * 100;
  return `inset(${top.toFixed(3)}% ${right.toFixed(3)}% ${bottom.toFixed(3)}% ${left.toFixed(3)}%)`;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(!!m.matches);
    onChange();
    // Safari < 14
    if (typeof m.addEventListener === 'function') {
      m.addEventListener('change', onChange);
      return () => m.removeEventListener('change', onChange);
    }
    // eslint-disable-next-line deprecation/deprecation
    m.addListener(onChange);
    // eslint-disable-next-line deprecation/deprecation
    return () => m.removeListener(onChange);
  }, []);

  return reduced;
}

export type SpatialAvatarProps = {
  src: string;
  alt?: string;
  width?: number | string;
  height?: number | string;
  layers: SpatialAvatarLayer[];
  motion?: MotionProfile;
  interactive?: boolean;
  className?: string;
};

export default function SpatialAvatar({
  src,
  alt,
  width = 160,
  height = 160,
  layers,
  motion,
  interactive = true,
  className,
}: SpatialAvatarProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const profile = useMemo<MotionProfile>(() => motion ?? DEFAULT_MOTION_PROFILE, [motion]);

  const rootRef = useRef<HTMLDivElement | null>(null);

  // Interaction state only (not per-frame) — safe to re-render.
  const [active, setActive] = useState(false);

  // Runtime state kept in refs to avoid per-frame React renders.
  const lastTRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const pointerTargetRef = useRef({ x: 0, y: 0, lastMoveT: 0, inside: false });
  const pointerStateRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });

  const breathRef = useRef({ phase: 0 });

  // Precompute per-layer seeds + weights so layers never move in sync.
  const layerRuntime = useMemo(() => {
    return layers.map((l) => {
      const h = fnv1a32(l.id);
      const s = (h ^ (profile.seed >>> 0)) >>> 0;
      const axisX = l.axis?.x ?? (0.95 + 0.25 * fract((s % 997) * 0.001)); // why: subtle individuality
      const axisY = l.axis?.y ?? (0.65 + 0.25 * fract((s % 991) * 0.001)); // why: avoid sync
      const breath = l.breath ?? clamp(0.25 + 0.75 * Math.max(0, l.z), 0, 1); // why: torso breath > face
      const phaseOffset = fract((s % 4093) * 0.00031) * Math.PI * 2;

      // Spec: clip-path inset(top right bottom left)
      const clipPath = rectToInset(l.rect);

      // Spec: set background-position (kept aligned to container).
      // NOTE: with background-size: 100% 100%, this is mostly a no-op; included per spec.
      const bgX = (-clamp(l.rect.x, 0, 1) * 100).toFixed(3) + '%';
      const bgY = (-clamp(l.rect.y, 0, 1) * 100).toFixed(3) + '%';

      return {
        ...l,
        _seed: s,
        _axisX: axisX,
        _axisY: axisY,
        _breath: breath,
        _phaseOffset: phaseOffset,
        _clipPath: clipPath,
        _bgX: bgX,
        _bgY: bgY,
      };
    });
  }, [layers, profile.seed]);

  const layerMax = useMemo(() => {
    const maxAbsZ = Math.max(0.001, ...layerRuntime.map((l) => Math.abs(l.z)));
    const maxAxis = Math.max(1, ...layerRuntime.map((l) => Math.max(l._axisX, l._axisY)));
    return { maxAbsZ, maxAxis };
  }, [layerRuntime]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // Write profile constants as CSS vars (numbers; CSS applies 1px/1deg units).
    // Drift clamps (spec): x/y <= 1.5px, rot <= 0.3deg. We enforce by clamping amplitude based on max layer depth.
    const driftAmpPx = Math.min(profile.driftAmpPx, 1.5 / layerMax.maxAbsZ);
    const driftRotDeg = Math.min(profile.driftRotDeg, 0.3 / layerMax.maxAbsZ);
    root.style.setProperty('--driftAmpPx', String(driftAmpPx));
    root.style.setProperty('--driftRotDeg', String(driftRotDeg));

    // Breath is global, but each layer scales it via --breath.
    root.style.setProperty('--breathAmpPx', String(profile.breathAmpPx));
    root.style.setProperty('--breathScale', String(profile.breathScale));

    // Reduced motion: stop rAF and shrink motion substantially (spec).
    if (prefersReducedMotion) {
      root.style.setProperty('--px', '0');
      root.style.setProperty('--py', '0');
      root.style.setProperty('--b', '0');
      root.style.setProperty('--dx', '0');
      root.style.setProperty('--dy', '0');
      root.style.setProperty('--rot', '0');
      root.style.setProperty('--s', '0');
      return;
    }

    const tick = (nowMs: number) => {
      const now = nowMs / 1000;
      const last = lastTRef.current ?? now;
      const dt = clamp(now - last, 0, 0.05);
      lastTRef.current = now;

      // --- Pointer smoothing (critically-damped-ish spring) ---
      const pTarget = pointerTargetRef.current;
      const p = pointerStateRef.current;

      const idleFor = now - pTarget.lastMoveT;
      const wantsReturn = !pTarget.inside || idleFor > clamp(profile.idleReturn, 0.2, 2.5);
      const tx = wantsReturn ? 0 : pTarget.x;
      const ty = wantsReturn ? 0 : pTarget.y;

      // why: embodied response without jitter
      const stiffness = 42;
      const damping = 2 * Math.sqrt(stiffness) * (1 + 0.35 * profile.pointerSmoothing);
      const ax = (tx - p.x) * stiffness - p.vx * damping;
      const ay = (ty - p.y) * stiffness - p.vy * damping;
      p.vx += ax * dt;
      p.vy += ay * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // --- Breathing (non-periodic) ---
      // why: avoid obvious looping by modulating rate & amplitude with low-frequency noise
      const rateMod = fbm1D(now * 0.055, profile.seed + 3); // [-1..1]
      const rateHz = clamp(profile.breathRateHz * (1 + 0.22 * rateMod), 0.06, 0.18);
      breathRef.current.phase += dt * rateHz * Math.PI * 2;

      // Shape the sine so inhale/exhale aren't perfectly symmetric.
      const raw = Math.sin(breathRef.current.phase);
      let x01 = (raw + 1) * 0.5;
      x01 = x01 < 0.5
        ? 0.5 * Math.pow(x01 / 0.5, 0.85)
        : 0.5 + 0.5 * Math.pow((x01 - 0.5) / 0.5, 1.25);
      const breath = (x01 - 0.5) * 2; // [-1..1]

      const ampMod = 1 + 0.18 * fbm1D(now * 0.035 + 10.1, profile.seed + 9);
      const breathSignal = breath * ampMod; // unitless [-~1..1]
      const scaleSignal = breath * (1 + 0.12 * fbm1D(now * 0.028 + 3.7, profile.seed + 11)); // unitless

      // --- Micro drift (non-periodic) ---
      // why: adds micro-life even when idle; avoids UI-like stillness
      const driftX = clamp(fbm1D(now * 0.19 + 0.2, profile.seed + 21), -1, 1);
      const driftY = clamp(fbm1D(now * 0.17 + 7.1, profile.seed + 22), -1, 1);
      const rot = clamp(fbm1D(now * 0.13 + 13.4, profile.seed + 23), -1, 1);

      // --- Hover / focus feedback (spec) ---
      const gain = active ? 1.12 : 1.0;

      // Parallax clamp (spec): keep subtle translates.
      // We clamp based on maxAbsZ and maxAxis, and allow a bit more room for breath/drift to still read.
      const reserve = 0.9 * (Math.abs(profile.breathAmpPx) + driftAmpPx * layerMax.maxAbsZ);
      const parallaxBudget = Math.max(0.6, profile.maxTranslatePx - reserve);
      const parallaxPx = Math.min(profile.parallaxPx, parallaxBudget / (layerMax.maxAbsZ * layerMax.maxAxis * gain));
      root.style.setProperty('--parallaxPx', String(parallaxPx));

      // Reduced motion factor is applied to all motion signals.
      const rm = prefersReducedMotion ? profile.reducedMotionFactor : 1;

      // Clamp ranges (spec): keep subtle.
      root.style.setProperty('--px', String(clamp(p.x, -1, 1)));
      root.style.setProperty('--py', String(clamp(p.y, -1, 1)));
      root.style.setProperty('--b', String(clamp(breathSignal * rm, -1, 1)));
      root.style.setProperty('--s', String(clamp(scaleSignal * rm, -1, 1)));
      root.style.setProperty('--dx', String(clamp(driftX * rm, -1, 1)));
      root.style.setProperty('--dy', String(clamp(driftY * rm, -1, 1)));
      root.style.setProperty('--rot', String(clamp(rot * rm, -1, 1)));
      root.style.setProperty('--gain', String(gain));

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTRef.current = null;
    };
  }, [active, layerRuntime, prefersReducedMotion, profile]);

  const onPointerMove = (e: React.PointerEvent) => {
    if (!interactive) return;
    const root = rootRef.current;
    if (!root) return;

    const r = root.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;

    // why: clamp so parallax stays emotionally subtle and never "following" too hard
    pointerTargetRef.current.x = clamp(nx, -1, 1);
    pointerTargetRef.current.y = clamp(ny, -1, 1);
    pointerTargetRef.current.lastMoveT = performance.now() / 1000;
    pointerTargetRef.current.inside = true;
  };

  const onPointerLeave = () => {
    pointerTargetRef.current.inside = false;
  };

  const onFocus = () => setActive(true);
  const onBlur = () => setActive(false);

  const rootStyle: React.CSSProperties = {
    width,
    height,
    // Base layer is the original PNG.
    backgroundImage: `url(${src})`,
  };

  return (
    <div
      ref={rootRef}
      className={['sa', active ? 'sa--active' : '', className].filter(Boolean).join(' ')}
      style={rootStyle}
      onPointerMove={onPointerMove}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => {
        setActive(false);
        onPointerLeave();
      }}
      onFocus={onFocus}
      onBlur={onBlur}
      tabIndex={interactive ? 0 : -1}
      role={alt ? 'img' : undefined}
      aria-label={alt}
    >
      {/* Layers (same PNG repeated 3–5x) sliced by clip-path inset (spec). */}
      {layerRuntime.map((lr) => (
        <div
          key={lr.id}
          className={['sa__layer', lr.className].filter(Boolean).join(' ')}
          style={{
            backgroundImage: `url(${src})`,
            clipPath: lr._clipPath,
            // Spec: background-size aligned to container + background-position computed
            backgroundSize: '100% 100%',
            backgroundPosition: `${lr._bgX} ${lr._bgY}`,
            // Per-layer vars for CSS transform composition
            ['--z' as any]: String(lr.z),
            ['--ax' as any]: String(lr._axisX),
            ['--ay' as any]: String(lr._axisY),
            ['--breath' as any]: String(lr._breath),
            ['--sa-bg-x' as any]: lr._bgX,
            ['--sa-bg-y' as any]: lr._bgY,
          }}
          aria-hidden="true"
        />
      ))}

      {/* Ambient glue — hides seams + adds presence without looking like an effect. */}
      <div className="sa__ambient" aria-hidden="true" />

      {/* Soft highlight on hover/focus (non-motion). */}
      <div className="sa__sheen" aria-hidden="true" />
    </div>
  );
}
