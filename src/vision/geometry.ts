import type { Pt } from '../types';

export const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
export const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
export const len = (a: Pt) => Math.hypot(a.x, a.y);
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
export const dist3 = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** MediaPipe hand landmark indices. */
export const LM = {
  WRIST: 0,
  THUMB: [1, 2, 3, 4],
  INDEX: [5, 6, 7, 8],
  MIDDLE: [9, 10, 11, 12],
  RING: [13, 14, 15, 16],
  PINKY: [17, 18, 19, 20],
} as const;

export const BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

/**
 * Palm coordinate frame built from landmarks.
 *  u: across the palm, +1 = one knuckle-width toward the index/thumb side
 *  v: along the palm, 0 = wrist, 1 = middle-finger knuckle
 * The frame is the same for left and right hands and for mirrored images,
 * so all downstream logic can ignore handedness.
 */
export interface PalmFrame {
  origin: Pt;
  ex: Pt; // unit vector toward radial (index) side
  ey: Pt; // unit vector toward fingers
  W: number; // knuckle width in px
  L: number; // palm length in px
  toImg(u: number, v: number): Pt;
  toUV(p: Pt): Pt;
}

export function palmFrame(lm: Pt[]): PalmFrame {
  const origin = lm[0];
  const axis = sub(lm[9], origin);
  const L = len(axis);
  const ey = mul(axis, 1 / L);
  let ex: Pt = { x: -ey.y, y: ey.x };
  if (dot(sub(lm[5], lm[17]), ex) < 0) ex = mul(ex, -1);
  const W = dist(lm[5], lm[17]);
  return {
    origin, ex, ey, W, L,
    toImg: (u, v) => ({
      x: origin.x + ex.x * u * W + ey.x * v * L,
      y: origin.y + ex.y * u * W + ey.y * v * L,
    }),
    toUV: (p) => {
      const d = sub(p, origin);
      return { x: dot(d, ex) / W, y: dot(d, ey) / L };
    },
  };
}

export function polylineLength(pts: Pt[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]);
  return s;
}

/** Max perpendicular deviation from the chord, relative to chord length. */
export function curvature(pts: Pt[]): number {
  if (pts.length < 3) return 0;
  const a = pts[0];
  const b = pts[pts.length - 1];
  const c = dist(a, b);
  if (c < 1e-6) return 0;
  const n = { x: -(b.y - a.y) / c, y: (b.x - a.x) / c };
  let m = 0;
  for (const p of pts) m = Math.max(m, Math.abs(dot(sub(p, a), n)));
  return m / c;
}

export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const ab = sub(b, a);
  const t = clamp(dot(sub(p, a), ab) / Math.max(dot(ab, ab), 1e-9));
  return dist(p, add(a, mul(ab, t)));
}

export function distToPolygonEdge(p: Pt, poly: Pt[]): number {
  let m = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) m = Math.min(m, distToSegment(p, poly[j], poly[i]));
  return m;
}
