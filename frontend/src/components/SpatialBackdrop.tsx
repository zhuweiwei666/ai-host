import { useEffect, useMemo, useRef } from 'react';
import { fbm1D } from './noise';
import { DEFAULT_MOTION_PROFILE, type MotionProfile } from './motionProfile';
import './SpatialBackdrop.css';

// Very light moving background using the SAME PNG.
// WHY: makes the scene feel alive even when the avatar is small.

export type SpatialBackdropProps = {
  src: string;
  className?: string;
  motion?: MotionProfile;
  opacity?: number;
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export default function SpatialBackdrop({
  src,
  className,
  motion,
  opacity = 0.28,
}: SpatialBackdropProps) {
  const profile = useMemo(() => motion ?? DEFAULT_MOTION_PROFILE, [motion]);
  const ref = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTRef = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Write once.
    el.style.setProperty('--bgOpacity', String(opacity));

    const tick = (nowMs: number) => {
      const now = nowMs / 1000;
      const last = lastTRef.current ?? now;
      clamp(now - last, 0, 0.05);
      lastTRef.current = now;

      // Non-periodic drift + subtle zoom (ken-burns feeling, but not looping).
      const dx = fbm1D(now * 0.05 + 1.1, profile.seed + 201);
      const dy = fbm1D(now * 0.047 + 9.7, profile.seed + 202);
      const z = fbm1D(now * 0.032 + 4.2, profile.seed + 203);

      const tx = dx * 10; // px (kept low)
      const ty = dy * 10;
      const scale = 1.06 + z * 0.02; // small zoom variance

      el.style.setProperty('--bgTx', `${tx.toFixed(2)}px`);
      el.style.setProperty('--bgTy', `${ty.toFixed(2)}px`);
      el.style.setProperty('--bgScale', `${scale.toFixed(4)}`);

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTRef.current = null;
    };
  }, [opacity, profile.seed]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        backgroundImage: `url(${src})`,
      }}
      aria-hidden="true"
    />
  );
}
