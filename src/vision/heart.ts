/**
 * "Heart hands" with two people: each shows one hand curved like a C; the
 * fingertips meet at the top and the thumb tips meet at the bottom.
 */
import type { Pt } from '../types';
import { dist } from './geometry';

export interface HeartPose {
  ok: boolean;
  /** 0..1, how close the pose is to a heart (for a progress ring) */
  score: number;
  top: Pt; // where the index fingertips meet
  bottom: Pt; // where the thumb tips meet
  width: number; // heart width in px
}

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export function detectHeart(a: Pt[], b: Pt[]): HeartPose {
  const s = (dist(a[0], a[9]) + dist(b[0], b[9])) / 2; // hand size
  const top = mid(a[8], b[8]);
  const bottom = mid(a[4], b[4]);
  const tipsGap = dist(a[8], b[8]) / s;
  const thumbsGap = dist(a[4], b[4]) / s;
  const height = (bottom.y - top.y) / s; // fingertips must be above the thumbs
  // the two hands sit on opposite sides of the heart's axis
  const side = (p: Pt) => Math.sign(p.x - top.x);
  const opposite = side(a[9]) !== side(b[9]);
  const width = Math.max(dist(a[6], b[6]), dist(a[10], b[10]), dist(a[5], b[5]));
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const score = opposite
    ? clamp01(1.2 - tipsGap) * clamp01(1.2 - thumbsGap) * clamp01(height / 0.5)
    : 0;
  const ok = opposite && tipsGap < 0.55 && thumbsGap < 0.6 && height > 0.45 && width > 0.6 * s;
  return { ok, score: ok ? 1 : Math.min(0.95, score), top, bottom, width };
}

/** Classic heart curve fitted between the meeting points. */
export function heartPath(top: Pt, bottom: Pt, width: number, steps = 90): Pt[] {
  const H = bottom.y - top.y;
  const cx = top.x;
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    // x ∈ [-16, 16], y ∈ [-17, 5]: the dip of the heart is at y = 5, the tip at y = -17
    pts.push({ x: cx + (x / 32) * width, y: top.y + ((5 - y) / 22) * H });
  }
  return pts;
}

/**
 * Are both hands likely to belong to ONE person? Returns -1 (two people) … +1 (one person).
 *
 * Forearm direction is estimated from the middle knuckle back through the wrist.
 * One person making a heart holds both forearms fairly upright, converging on one
 * body below. Two people side by side reach in from opposite sides, so their
 * forearms slant strongly outward. Similar hand size adds a little evidence.
 */
export function samePersonScore(a: Pt[], b: Pt[]): number {
  const slant = (h: Pt[]) => {
    const dx = h[0].x - h[9].x, dy = h[0].y - h[9].y; // toward the elbow
    if (dy <= 0) return 90; // forearm pointing up: hands reaching over, treat as sideways
    return (Math.atan2(Math.abs(dx), dy) * 180) / Math.PI;
  };
  const meanSlant = (slant(a) + slant(b)) / 2;
  let s = meanSlant < 32 ? 1 : meanSlant > 50 ? -1 : 1 - ((meanSlant - 32) / 18) * 2;
  const sa = dist(a[0], a[9]), sb = dist(b[0], b[9]);
  const ratio = Math.max(sa, sb) / Math.min(sa, sb);
  if (ratio > 1.2) s -= 0.4;
  else if (ratio < 1.06) s += 0.15;
  return Math.max(-1, Math.min(1, s));
}
