// Motion profile parameters (not frames).
// Keep these subtle — realism comes from variance, not amplitude.

export type MotionProfile = {
  /** Base calm tempo (Hz). Non-periodic because we modulate rate with noise. */
  breathRateHz: number;
  /** Tiny lift on inhale (px). Conveys life without "animation". */
  breathAmpPx: number;
  /** Micro expansion (unitless). Sells volume. */
  breathScale: number;

  /** Micro drift amplitude (px). Prevents dead stillness. */
  driftAmpPx: number;
  /** Drift rotation amplitude (deg). Adds organic imperfection. */
  driftRotDeg: number;

  /** Cursor depth response at z=1 (px). Creates 2.5D. */
  parallaxPx: number;

  /** Pointer smoothing (seconds). Removes jitter; feels embodied. */
  pointerSmoothing: number;
  /** Idle return (seconds). Smoothly relax back to neutral. */
  idleReturn: number;

  /** Deterministic seed. Same seed => same "personality". */
  seed: number;

  /** Global clamps (safety). */
  maxTranslatePx: number;
  maxRotDeg: number;

  /** Reduced-motion multiplier (0..1). */
  reducedMotionFactor: number;
};

export const DEFAULT_MOTION_PROFILE: MotionProfile = {
  // Breathing
  breathRateHz: 0.11,
  breathAmpPx: 1.1,
  breathScale: 0.006,

  // Drift
  driftAmpPx: 1.0,
  driftRotDeg: 0.22,

  // Parallax
  // Note: actual parallax is clamped at runtime based on layer depths (z) to stay subtle.
  parallaxPx: 7,

  // Interaction smoothing
  pointerSmoothing: 0.10,
  idleReturn: 0.85,

  seed: 1337,

  // Spec ranges: drift <= 1.5px, rot <= 0.3deg; overall translate typically <= 2px (face may go ~3px on large avatars).
  maxTranslatePx: 2.2,
  maxRotDeg: 0.3,

  // If user prefers reduced motion, we multiply motion by this factor.
  reducedMotionFactor: 0.2,
};
