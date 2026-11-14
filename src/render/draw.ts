import type { LineKey, Pt, Profile, Analysis } from '../types';
import { BONES, dist } from '../vision/geometry';

export const LINE_COLORS: Record<LineKey, string> = {
  heart: '#ff5c8a',
  head: '#5cc8ff',
  life: '#7dffa8',
  fate: '#ffd25c',
};

export function resample(pts: Pt[], n: number): Pt[] {
  if (pts.length < 2) return pts.slice();
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  const total = cum[cum.length - 1];
  const out: Pt[] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const d = (total * k) / (n - 1);
    while (j < cum.length - 2 && cum[j + 1] < d) j++;
    const t = (d - cum[j]) / Math.max(cum[j + 1] - cum[j], 1e-9);
    out.push({ x: pts[j].x + (pts[j + 1].x - pts[j].x) * t, y: pts[j].y + (pts[j + 1].y - pts[j].y) * t });
  }
  return out;
}

export function strokePath(g: CanvasRenderingContext2D, pts: Pt[], progress = 1) {
  if (pts.length < 2) return;
  const n = Math.max(2, Math.floor(pts.length * progress));
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < n; i++) g.lineTo(pts[i].x, pts[i].y);
  g.stroke();
}

export function glowStroke(g: CanvasRenderingContext2D, pts: Pt[], color: string, width: number, progress = 1) {
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = color;
  g.shadowColor = color;
  g.shadowBlur = width * 3;
  g.globalAlpha = 0.45;
  g.lineWidth = width * 2.4;
  strokePath(g, pts, progress);
  g.globalAlpha = 1;
  g.shadowBlur = width * 1.5;
  g.lineWidth = width;
  strokePath(g, pts, progress);
  g.restore();
}

export function drawSkeleton(g: CanvasRenderingContext2D, lm: Pt[], scale: number, color = 'rgba(255,255,255,0.85)', progress = 1) {
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = color;
  g.lineWidth = 2.2 * scale;
  g.shadowColor = color;
  g.shadowBlur = 6 * scale;
  const nb = Math.ceil(BONES.length * progress);
  for (let i = 0; i < nb; i++) {
    const [a, b] = BONES[i];
    g.beginPath();
    g.moveTo(lm[a].x, lm[a].y);
    g.lineTo(lm[b].x, lm[b].y);
    g.stroke();
  }
  g.fillStyle = '#fff';
  const np = Math.ceil(21 * progress);
  for (let i = 0; i < np; i++) {
    g.beginPath();
    g.arc(lm[i].x, lm[i].y, (i === 0 ? 5 : 3.6) * scale, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

export interface HandStyle {
  cx: number;
  cy: number;
  /** pixels per knuckle-width */
  size: number;
  /** palm length / width (for the v axis) */
  aspect: number;
  mirror?: boolean;
  rotate?: number;
  fill?: string;
  edge?: string;
  lineWidth?: number;
  progress?: number;
  showLines?: boolean;
  lineColor?: string | null; // null = per-line colours
}

/** Turns palm (u, v) coordinates into canvas points for a stylised hand. */
export function uvMapper(s: HandStyle) {
  const c = Math.cos(s.rotate ?? 0), sn = Math.sin(s.rotate ?? 0);
  return (p: Pt): Pt => {
    // centre the hand roughly on the palm middle (v ≈ 0.9 of the full hand height)
    const x = (s.mirror ? 1 : -1) * p.x * s.size;
    const y = -(p.y - 0.9) * s.aspect * s.size;
    return { x: s.cx + x * c - y * sn, y: s.cy + x * sn + y * c };
  };
}

export function drawStylizedHand(g: CanvasRenderingContext2D, norm: Pt[], lines: Partial<Record<LineKey, Pt[]>>, s: HandStyle) {
  const map = uvMapper(s);
  const P = norm.map(map);
  const fill = s.fill ?? 'rgba(255,255,255,0.06)';
  const edge = s.edge ?? 'rgba(232,195,114,0.9)';
  const w = s.size;
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // palm body
  const palmIdx = [0, 1, 2, 5, 9, 13, 17];
  const ul = { x: P[17].x + (P[17].x - P[13].x) * 0.55, y: P[17].y + (P[17].y - P[13].y) * 0.55 };
  const wr = { x: P[0].x + (ul.x - P[17].x) * 0.6 + (P[17].x - P[0].x) * 0.12, y: P[0].y + (P[17].y - P[0].y) * 0.12 };
  g.beginPath();
  palmIdx.forEach((k, i) => (i ? g.lineTo(P[k].x, P[k].y) : g.moveTo(P[k].x, P[k].y)));
  g.lineTo(ul.x, ul.y);
  g.lineTo(wr.x, wr.y);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  // fingers as soft capsules
  const fingers = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
  const fw = [0.3, 0.26, 0.27, 0.25, 0.21];
  fingers.forEach((ch, f) => {
    g.strokeStyle = fill;
    g.lineWidth = fw[f] * w;
    g.beginPath();
    ch.forEach((k, i) => (i ? g.lineTo(P[k].x, P[k].y) : g.moveTo(P[k].x, P[k].y)));
    g.stroke();
  });
  // skeleton
  g.strokeStyle = edge;
  g.shadowColor = edge;
  g.shadowBlur = 0.05 * w;
  g.lineWidth = Math.max(1.2, 0.022 * w);
  for (const [a, b] of BONES) {
    g.beginPath();
    g.moveTo(P[a].x, P[a].y);
    g.lineTo(P[b].x, P[b].y);
    g.stroke();
  }
  g.fillStyle = edge;
  for (const p of P) {
    g.beginPath();
    g.arc(p.x, p.y, Math.max(2, 0.03 * w), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  if (s.showLines !== false) {
    for (const k of ['heart', 'head', 'life', 'fate'] as LineKey[]) {
      const pts = lines[k];
      if (!pts || pts.length < 2) continue;
      glowStroke(g, pts.map(map), s.lineColor ?? LINE_COLORS[k], s.lineWidth ?? Math.max(2, 0.035 * w), s.progress ?? 1);
    }
  }
}

export function normFromProfile(p: Profile): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < 42; i += 2) out.push({ x: p.k[i], y: p.k[i + 1] });
  return out;
}

export function linesFromProfile(p: Profile): Partial<Record<LineKey, Pt[]>> {
  const keys: LineKey[] = ['heart', 'head', 'life'];
  const out: Partial<Record<LineKey, Pt[]>> = {};
  (p.ln ?? []).forEach((arr, i) => {
    if (!arr.length) return;
    const pts: Pt[] = [];
    for (let j = 0; j < arr.length; j += 2) pts.push({ x: arr[j], y: arr[j + 1] });
    out[keys[i]] = smoothCurve(pts, 4);
  });
  return out;
}

export function linesFromAnalysis(a: Analysis): Partial<Record<LineKey, Pt[]>> {
  const out: Partial<Record<LineKey, Pt[]>> = {};
  for (const k of ['heart', 'head', 'life', 'fate'] as LineKey[]) if (a.lines[k].present) out[k] = a.lines[k].uv;
  return out;
}

/** Catmull-Rom subdivision for smooth curves from few points. */
export function smoothCurve(pts: Pt[], steps: number): Pt[] {
  if (pts.length < 3) return pts;
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function starfield(g: CanvasRenderingContext2D, w: number, h: number, seed = 3, n = 140) {
  let s = seed;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  g.save();
  for (let i = 0; i < n; i++) {
    g.globalAlpha = 0.15 + r() * 0.6;
    g.fillStyle = r() > 0.85 ? '#e8c372' : '#ffffff';
    g.beginPath();
    g.arc(r() * w, r() * h, r() * 1.8 + 0.3, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}
