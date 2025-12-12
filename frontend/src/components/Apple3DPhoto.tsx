import { useEffect, useMemo, useRef, useState } from 'react';
import { fbm1D } from './noise';

import './Apple3DPhoto.css';

export type Apple3DPhotoProps = {
  src: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  interactive?: boolean;

  /** Max tilt degrees (small feels premium). */
  tiltDeg?: number;
  /** Max translate in px (subtle). */
  translatePx?: number;
  /** Glare intensity 0..1. */
  glare?: number;

  /** Optional seed for non-periodic drift. */
  seed?: number;
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(!!m.matches);
    onChange();
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

/**
 * Apple-like "3D photo" illusion:
 * - One image
 * - Perspective tilt + lighting (glare) + shadow
 * - Non-periodic micro drift so it never feels static
 */
export default function Apple3DPhoto({
  src,
  width = 240,
  height = 240,
  className,
  interactive = true,
  tiltDeg = 8,
  translatePx = 10,
  glare = 0.9,
  seed = 1337,
}: Apple3DPhotoProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);

  const pointerTarget = useRef({ x: 0, y: 0, inside: false, lastMoveT: 0 });
  const pointer = useRef({ x: 0, y: 0, vx: 0, vy: 0 });

  const config = useMemo(() => ({ tiltDeg, translatePx, glare, seed }), [tiltDeg, translatePx, glare, seed]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.setProperty('--pTilt', String(config.tiltDeg));
    el.style.setProperty('--pTrans', String(config.translatePx));
    el.style.setProperty('--pGlare', String(clamp(config.glare, 0, 1)));

    if (prefersReducedMotion) {
      el.style.setProperty('--rx', '0');
      el.style.setProperty('--ry', '0');
      el.style.setProperty('--tx', '0');
      el.style.setProperty('--ty', '0');
      el.style.setProperty('--gx', '50%');
      el.style.setProperty('--gy', '35%');
      return;
    }

    let raf: number | null = null;
    let lastT: number | null = null;

    const tick = (nowMs: number) => {
      const now = nowMs / 1000;
      const last = lastT ?? now;
      const dt = clamp(now - last, 0, 0.05);
      lastT = now;

      // Idle return.
      const idleFor = now - pointerTarget.current.lastMoveT;
      const wantsReturn = !pointerTarget.current.inside || idleFor > 0.8;
      const tx = wantsReturn ? 0 : pointerTarget.current.x;
      const ty = wantsReturn ? 0 : pointerTarget.current.y;

      // Critically-damped-ish spring.
      const stiffness = 48;
      const damping = 2 * Math.sqrt(stiffness) * 1.1;
      const ax = (tx - pointer.current.x) * stiffness - pointer.current.vx * damping;
      const ay = (ty - pointer.current.y) * stiffness - pointer.current.vy * damping;
      pointer.current.vx += ax * dt;
      pointer.current.vy += ay * dt;
      pointer.current.x += pointer.current.vx * dt;
      pointer.current.y += pointer.current.vy * dt;

      // Non-periodic drift (very small) so it never feels like a loop.
      const dx = fbm1D(now * 0.06 + 1.7, config.seed + 901) * 0.18;
      const dy = fbm1D(now * 0.055 + 9.2, config.seed + 902) * 0.18;

      const x = clamp(pointer.current.x + dx, -1, 1);
      const y = clamp(pointer.current.y + dy, -1, 1);

      // Map pointer to rotation and translation.
      el.style.setProperty('--rx', String(x));
      el.style.setProperty('--ry', String(y));
      el.style.setProperty('--tx', String(x));
      el.style.setProperty('--ty', String(y));

      // Glare position (in %), follows pointer.
      el.style.setProperty('--gx', `${(50 + x * 22).toFixed(2)}%`);
      el.style.setProperty('--gy', `${(35 + y * 22).toFixed(2)}%`);

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [config, prefersReducedMotion]);

  const onPointerMove = (e: React.PointerEvent) => {
    if (!interactive) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    pointerTarget.current.x = clamp(nx, -1, 1);
    pointerTarget.current.y = clamp(ny, -1, 1);
    pointerTarget.current.inside = true;
    pointerTarget.current.lastMoveT = performance.now() / 1000;
  };

  return (
    <div
      ref={ref}
      className={['a3d', className].filter(Boolean).join(' ')}
      style={{ width, height, backgroundImage: `url(${src})` }}
      onPointerMove={onPointerMove}
      onPointerEnter={() => {
        pointerTarget.current.inside = true;
      }}
      onPointerLeave={() => {
        pointerTarget.current.inside = false;
      }}
      tabIndex={interactive ? 0 : -1}
    >
      <div className="a3d__img" style={{ backgroundImage: `url(${src})` }} aria-hidden="true" />
      <div className="a3d__glare" aria-hidden="true" />
    </div>
  );
}
