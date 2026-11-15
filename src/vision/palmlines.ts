/**
 * Palm crease ("palm line") detection that runs entirely in the browser.
 *
 * Pipeline
 *  1. Resample the palm into a canonical patch using the landmark frame
 *     (wrist → middle knuckle = v, across knuckles = u). Left/right and
 *     mirrored images all end up in the same orientation.
 *  2. Normalise local contrast, then compute a multi-scale Hessian "valley"
 *     response: creases are thin lines darker than the skin around them.
 *  3. For each named crease, find the strongest continuous path inside an
 *     anatomically plausible band with dynamic programming (a minimum-cost
 *     path, as in seam carving). The life line is searched in polar
 *     coordinates around the thumb base.
 *  4. Trim each path to the part where the response is actually strong, and
 *     report length, curvature and clarity.
 *
 * Bands come from anatomy: the distal transverse crease ("heart line") lies
 * over the ring/little finger knuckles, the proximal transverse crease ("head
 * line") starts near the index knuckle, and the thenar crease ("life line")
 * curves around the thumb's base.
 */
import type { LineKey, LineResult, Pt, Quality } from '../types';
import { clamp, curvature as curv, palmFrame, pointInPolygon, distToPolygonEdge, polylineLength, type PalmFrame } from './geometry';

const U0 = -0.85, U1 = 0.9, V0 = -0.1, V1 = 1.1;
const PATCH_W = 220;

export interface PalmPatch {
  w: number;
  h: number;
  lum: Float32Array;
  mask: Uint8Array;
  resp: Float32Array;
  /** absolute crease depth: local background luminance minus luminance at the pixel */
  dip: Float32Array;
  /** robust spread (1.4826 × MAD) of `dip` over the palm: the skin-texture/noise floor */
  dipNoise: number;
  /** number of frames averaged into the patch */
  frames: number;
  frame: PalmFrame;
  /** patch pixel → uv */
  uvAt(i: number, j: number): Pt;
  /** uv → fractional patch pixel */
  pxAt(u: number, v: number): Pt;
}

export interface PatchOptions {
  /** patch width in px (220 for analysis, smaller for the live meter) */
  patchW?: number;
  /** extra frames of the same hand (e.g. a camera burst) averaged in palm space to cut noise */
  extras?: { image: HTMLCanvasElement | ImageData; landmarks: Pt[] }[];
}

export interface LinesOutput {
  lines: Record<LineKey, LineResult>;
  quality: Quality;
  singleCrease: boolean;
  patch: PalmPatch;
}

// ---------------------------------------------------------------- utilities

function gaussKernel(sigma: number): Float32Array {
  const r = Math.max(1, Math.ceil(sigma * 3));
  const k = new Float32Array(2 * r + 1);
  let s = 0;
  for (let i = -r; i <= r; i++) s += k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma));
  for (let i = 0; i < k.length; i++) k[i] /= s;
  return k;
}

export function blur(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  const k = gaussKernel(sigma);
  const r = (k.length - 1) / 2;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let t = -r; t <= r; t++) s += src[y * w + Math.min(w - 1, Math.max(0, x + t))] * k[t + r];
      tmp[y * w + x] = s;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let t = -r; t <= r; t++) s += tmp[Math.min(h - 1, Math.max(0, y + t)) * w + x] * k[t + r];
      out[y * w + x] = s;
    }
  return out;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 1;
  const s = values.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

function sampleLum(data: Uint8ClampedArray, iw: number, ih: number, x: number, y: number): number {
  x = Math.min(iw - 1.001, Math.max(0, x));
  y = Math.min(ih - 1.001, Math.max(0, y));
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const px = (xx: number, yy: number) => {
    const o = (yy * iw + xx) * 4;
    // green-weighted luminance: creases contrast best in the green channel on skin
    return (0.25 * data[o] + 0.6 * data[o + 1] + 0.15 * data[o + 2]) / 255;
  };
  return (
    px(x0, y0) * (1 - fx) * (1 - fy) +
    px(x0 + 1, y0) * fx * (1 - fy) +
    px(x0, y0 + 1) * (1 - fx) * fy +
    px(x0 + 1, y0 + 1) * fx * fy
  );
}

// ------------------------------------------------------------ patch + ridge

const pixels = (image: HTMLCanvasElement | ImageData): ImageData =>
  image instanceof ImageData ? image : image.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, image.width, image.height);

export function buildPatch(image: HTMLCanvasElement | ImageData, lm: Pt[], opts: PatchOptions = {}): PalmPatch {
  const img = pixels(image);
  const frame = palmFrame(lm);
  const w = opts.patchW ?? PATCH_W;
  const scale = ((U1 - U0) * frame.W) / w; // image px per patch px
  const h = Math.max(40, Math.round(((V1 - V0) * frame.L) / scale));
  const uvAt = (i: number, j: number): Pt => ({ x: U0 + ((i + 0.5) / w) * (U1 - U0), y: V1 - ((j + 0.5) / h) * (V1 - V0) });
  const pxAt = (u: number, v: number): Pt => ({ x: ((u - U0) / (U1 - U0)) * w - 0.5, y: ((V1 - v) / (V1 - V0)) * h - 0.5 });

  // palm polygon in uv (landmarks + an estimate of the ulnar palm border)
  const uv = lm.map((p) => frame.toUV(p));
  const ul = { x: uv[17].x + (uv[17].x - uv[13].x) * 0.75, y: uv[17].y - 0.04 };
  const poly: Pt[] = [
    { x: uv[0].x + 0.05, y: uv[0].y - 0.06 },
    uv[1],
    uv[2],
    { x: (uv[2].x + uv[5].x) / 2 + 0.04, y: (uv[2].y + uv[5].y) / 2 },
    uv[5], uv[9], uv[13], uv[17],
    ul,
    { x: ul.x * 0.9, y: 0.12 },
    { x: uv[0].x - 0.3, y: uv[0].y - 0.04 },
  ];
  // polygon in physical (W-normalised) units for edge distances
  const aspect = frame.L / frame.W;
  const polyPhys = poly.map((p) => ({ x: p.x, y: p.y * aspect }));

  const lum = new Float32Array(w * h);
  const mask = new Uint8Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const q = uvAt(i, j);
      const p = frame.toImg(q.x, q.y);
      lum[j * w + i] = sampleLum(img.data, img.width, img.height, p.x, p.y);
      const inside = pointInPolygon(q, poly) && p.x >= 0 && p.y >= 0 && p.x < img.width && p.y < img.height;
      if (inside && distToPolygonEdge({ x: q.x, y: q.y * aspect }, polyPhys) > 0.03) mask[j * w + i] = 1;
    }

  // Average extra frames in palm coordinates. Each frame is sampled with its own
  // landmarks, so small hand movements between frames cancel out.
  let frames = 1;
  for (const ex of opts.extras ?? []) {
    if (ex.landmarks.length !== 21) continue;
    const f2 = palmFrame(ex.landmarks);
    if (Math.abs(f2.W / frame.W - 1) > 0.15 || Math.abs(f2.L / f2.W / (frame.L / frame.W) - 1) > 0.12) continue; // hand turned too much
    const im2 = pixels(ex.image);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const q = uvAt(i, j);
        const p = f2.toImg(q.x, q.y);
        lum[j * w + i] += sampleLum(im2.data, im2.width, im2.height, p.x, p.y);
      }
    frames++;
  }
  if (frames > 1) for (let k = 0; k < lum.length; k++) lum[k] /= frames;

  const resp = ridgeResponse(lum, mask, w, h, scale);
  const { dip, dipNoise } = creaseDepth(lum, mask, w, h, scale);
  return { w, h, lum, mask, resp, dip, dipNoise, frames, frame, uvAt, pxAt };
}

/** Absolute crease depth in luminance units, plus the noise floor it is judged against. */
function creaseDepth(lum: Float32Array, mask: Uint8Array, w: number, h: number, scale: number) {
  const base = Math.max(0.9, 0.9 / Math.max(scale / 2, 0.5));
  const fine = blur(lum, w, h, base);
  const coarse = blur(lum, w, h, base * 4);
  const dip = new Float32Array(w * h);
  const vals: number[] = [];
  for (let k = 0; k < dip.length; k++) {
    if (!mask[k]) continue;
    dip[k] = coarse[k] - fine[k];
    vals.push(dip[k]);
  }
  const med = percentile(vals, 0.5);
  const mad = percentile(vals.map((v) => Math.abs(v - med)), 0.5);
  return { dip, dipNoise: Math.max(1.4826 * mad, 0.0025) };
}

function ridgeResponse(lum: Float32Array, mask: Uint8Array, w: number, h: number, scale: number): Float32Array {
  // local contrast normalisation
  const bg = blur(lum, w, h, 9);
  const res = new Float32Array(w * h);
  for (let k = 0; k < res.length; k++) res[k] = lum[k] - bg[k];
  const sq = new Float32Array(w * h);
  for (let k = 0; k < res.length; k++) sq[k] = res[k] * res[k];
  const sd = blur(sq, w, h, 12);
  for (let k = 0; k < res.length; k++) res[k] /= Math.sqrt(sd[k]) + 0.02;

  // creases are ~1–4 % of knuckle width; scale-aware sigma set
  const base = Math.max(0.9, 0.9 / Math.max(scale / 2, 0.5));
  const sigmas = [base, base * 1.7, base * 2.6];
  const out = new Float32Array(w * h);
  for (const s of sigmas) {
    const g = blur(res, w, h, s);
    const s2 = s * s;
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const k = y * w + x;
        if (!mask[k]) continue;
        const dxx = g[k + 1] - 2 * g[k] + g[k - 1];
        const dyy = g[k + w] - 2 * g[k] + g[k - w];
        const dxy = (g[k + w + 1] - g[k + w - 1] - g[k - w + 1] + g[k - w - 1]) / 4;
        const tr = (dxx + dyy) / 2;
        const disc = Math.sqrt(((dxx - dyy) / 2) ** 2 + dxy * dxy);
        const l1 = tr + disc; // larger eigenvalue: positive across a dark valley
        const l2 = tr - disc;
        if (l1 <= 0) continue;
        const blobness = Math.min(1, Math.abs(l2) / (l1 + 1e-6));
        const r = s2 * l1 * (1 - 0.7 * blobness);
        if (r > out[k]) out[k] = r;
      }
  }
  const vals: number[] = [];
  for (let k = 0; k < out.length; k++) if (mask[k] && out[k] > 0) vals.push(out[k]);
  const p = percentile(vals, 0.985) || 1;
  for (let k = 0; k < out.length; k++) out[k] = mask[k] ? clamp(out[k] / p) : 0;
  return out;
}

// --------------------------------------------------------------- path search

function respAt(P: PalmPatch, x: number, y: number): number {
  const i = Math.round(x), j = Math.round(y);
  if (i < 1 || j < 1 || i >= P.w - 1 || j >= P.h - 1) return -0.2;
  const k = j * P.w + i;
  if (!P.mask[k]) return -0.2;
  // tolerate 1px misalignment across the line
  return Math.max(P.resp[k], 0.85 * P.resp[k - P.w], 0.85 * P.resp[k + P.w], 0.85 * P.resp[k - 1], 0.85 * P.resp[k + 1]);
}

/**
 * Generic DP: for each step t (0..T-1) choose a level m (0..M-1) so that the
 * path maximises response with limited jumps between consecutive steps.
 */
function dp(T: number, M: number, score: (t: number, m: number) => number, maxJump: number, jumpCost: number): number[] {
  const acc = new Float32Array(T * M);
  const from = new Int16Array(T * M);
  for (let m = 0; m < M; m++) acc[m] = -score(0, m);
  for (let t = 1; t < T; t++)
    for (let m = 0; m < M; m++) {
      let best = Infinity, arg = m;
      for (let d = -maxJump; d <= maxJump; d++) {
        const q = m + d;
        if (q < 0 || q >= M) continue;
        const c = acc[(t - 1) * M + q] + Math.abs(d) * jumpCost;
        if (c < best) { best = c; arg = q; }
      }
      acc[t * M + m] = best - score(t, m);
      from[t * M + m] = arg;
    }
  let m = 0, best = Infinity;
  for (let q = 0; q < M; q++) if (acc[(T - 1) * M + q] < best) { best = acc[(T - 1) * M + q]; m = q; }
  const path = new Array<number>(T);
  for (let t = T - 1; t >= 0; t--) { path[t] = m; m = from[t * M + m]; }
  return path;
}

/** Longest run where the (smoothed) response is above threshold, allowing short gaps. */
function strongSegment(r: number[], thr: number, maxGap: number): [number, number] | null {
  const sm = r.map((_, i) => {
    let s = 0, n = 0;
    for (let k = -2; k <= 2; k++) if (r[i + k] !== undefined) { s += r[i + k]; n++; }
    return s / n;
  });
  let best: [number, number] | null = null;
  let start = -1, last = -1;
  for (let i = 0; i <= sm.length; i++) {
    const on = i < sm.length && sm[i] >= thr;
    if (on) {
      if (start < 0 || i - last > maxGap + 1) {
        if (start >= 0 && (!best || last - start > best[1] - best[0])) best = [start, last];
        start = i;
      }
      last = i;
    }
  }
  if (start >= 0 && (!best || last - start > best[1] - best[0])) best = [start, last];
  return best;
}

/** Crease depth at a path point, in multiples of the palm's noise floor (best of ±1 px). */
function snrAt(P: PalmPatch, x: number, y: number): number {
  const i = Math.round(x), j = Math.round(y);
  if (i < 1 || j < 1 || i >= P.w - 1 || j >= P.h - 1) return 0;
  const k = j * P.w + i;
  if (!P.mask[k]) return 0;
  const d = Math.max(P.dip[k], P.dip[k - P.w], P.dip[k + P.w], P.dip[k - 1], P.dip[k + 1]);
  return d / P.dipNoise;
}

/** A crease counts as seen only if it is clearly deeper than the skin texture and noise. */
export const SNR_ON = 2.2; // per-point, to trim the segment
export const SNR_PRESENT = 3.0; // mean over the segment
export const MIN_DIP = 0.008; // ~0.8 % luminance: below this nothing is reliably visible

function finish(P: PalmPatch, key: LineKey, pts: Pt[], minLen: number, minSnr = SNR_PRESENT): LineResult {
  const r = pts.map((p) => snrAt(P, p.x, p.y));
  const seg = strongSegment(r, SNR_ON, Math.max(3, Math.round(pts.length * 0.08)));
  const empty: LineResult = { key, img: [], uv: [], length: 0, curvature: 0, clarity: 0, present: false };
  if (!seg) return empty;
  const part = pts.slice(seg[0], seg[1] + 1);
  const rs = r.slice(seg[0], seg[1] + 1);
  const uv = part.map((p) => P.uvAt(p.x, p.y));
  const aspect = P.frame.L / P.frame.W;
  const phys = uv.map((p) => ({ x: p.x, y: p.y * aspect }));
  const length = polylineLength(phys);
  const meanSnr = rs.reduce((a, b) => a + b, 0) / rs.length;
  const meanDip = meanSnr * P.dipNoise;
  const smoothUV = smooth(uv, 3);
  return {
    key,
    uv: smoothUV,
    img: smoothUV.map((p) => P.frame.toImg(p.x, p.y)),
    length,
    curvature: curv(phys),
    // 0 at the detection threshold, 1 for a crease ~8× deeper than the noise floor
    clarity: clamp((meanSnr - 2) / 6),
    present: length >= minLen && meanSnr >= minSnr && meanDip >= MIN_DIP,
  };
}

function smooth(pts: Pt[], r: number): Pt[] {
  return pts.map((_, i) => {
    let x = 0, y = 0, n = 0;
    for (let k = -r; k <= r; k++) {
      const p = pts[i + k];
      if (p) { x += p.x; y += p.y; n++; }
    }
    return { x: x / n, y: y / n };
  });
}

/** Horizontal crease: one row per column, row constrained to a band. */
function traceHorizontal(P: PalmPatch, uFrom: number, uTo: number, center: (u: number) => number, half: number, penalty?: (i: number, j: number) => number): Pt[] {
  const a = Math.round(P.pxAt(Math.min(uFrom, uTo), 0).x);
  const b = Math.round(P.pxAt(Math.max(uFrom, uTo), 0).x);
  const cols: number[] = [];
  for (let i = Math.max(1, a); i <= Math.min(P.w - 2, b); i++) cols.push(i);
  const rowsPerV = P.h / (V1 - V0);
  const M = Math.max(5, Math.round(2 * half * rowsPerV));
  const rowOf = (t: number, m: number) => {
    const u = P.uvAt(cols[t], 0).x;
    return P.pxAt(u, center(u) + half).y + m;
  };
  const path = dp(cols.length, M, (t, m) => {
    const j = rowOf(t, m);
    return respAt(P, cols[t], j) - (penalty ? penalty(cols[t], j) : 0);
  }, 1, 0.08);
  return cols.map((i, t) => ({ x: i, y: rowOf(t, path[t]) }));
}

/** Vertical crease (fate line): one column per row. */
function traceVertical(P: PalmPatch, vFrom: number, vTo: number, center: (v: number) => number, half: number, penalty?: (i: number, j: number) => number): Pt[] {
  const a = Math.round(P.pxAt(0, Math.max(vFrom, vTo)).y);
  const b = Math.round(P.pxAt(0, Math.min(vFrom, vTo)).y);
  const rows: number[] = [];
  for (let j = Math.max(1, a); j <= Math.min(P.h - 2, b); j++) rows.push(j);
  const colsPerU = P.w / (U1 - U0);
  const M = Math.max(5, Math.round(2 * half * colsPerU));
  const colOf = (t: number, m: number) => {
    const v = P.uvAt(0, rows[t]).y;
    return P.pxAt(center(v) - half, v).x + m;
  };
  const path = dp(rows.length, M, (t, m) => {
    const i = colOf(t, m);
    return respAt(P, i, rows[t]) - (penalty ? penalty(i, rows[t]) : 0);
  }, 1, 0.08);
  return rows.map((j, t) => ({ x: colOf(t, path[t]), y: j }));
}

/** Arc around a centre (life line): one radius per angle step. */
function traceArc(P: PalmPatch, c: Pt, a0: number, a1: number, r0: number, r1: number): Pt[] {
  const T = 110, M = Math.max(10, Math.round(r1 - r0));
  const at = (t: number, m: number) => {
    const a = a0 + ((a1 - a0) * t) / (T - 1);
    const r = r0 + ((r1 - r0) * m) / (M - 1);
    return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) };
  };
  const path = dp(T, M, (t, m) => {
    const p = at(t, m);
    return respAt(P, p.x, p.y);
  }, 2, 0.06);
  return path.map((m, t) => at(t, m));
}

function nearPath(path: Pt[], radius: number) {
  return (i: number, j: number) => {
    for (const p of path) if (Math.abs(p.x - i) <= radius && Math.abs(p.y - j) <= radius) return 0.6;
    return 0;
  };
}

// ------------------------------------------------------------------ quality

function measureQuality(P: PalmPatch): Quality {
  let n = 0, s = 0, s2 = 0, lap = 0;
  for (let j = 1; j < P.h - 1; j++)
    for (let i = 1; i < P.w - 1; i++) {
      const k = j * P.w + i;
      if (!P.mask[k]) continue;
      const v = P.lum[k];
      n++; s += v; s2 += v * v;
      const l = 4 * v - P.lum[k - 1] - P.lum[k + 1] - P.lum[k - P.w] - P.lum[k + P.w];
      lap += l * l;
    }
  n = Math.max(n, 1);
  const brightness = s / n;
  const contrast = Math.sqrt(Math.max(0, s2 / n - brightness * brightness));
  const sharpness = clamp(Math.sqrt(lap / n) / 0.035);
  const issues: Quality['issues'] = [];
  if (brightness < 0.22) issues.push('dark');
  if (brightness > 0.92) issues.push('bright');
  if (sharpness < 0.18) issues.push('blurry');
  if (P.frame.W < 80) issues.push('small');
  return { brightness, contrast, sharpness, ok: issues.length === 0, issues };
}

// --------------------------------------------------------------------- main

export function detectPalmLines(image: HTMLCanvasElement | ImageData, lm: Pt[], opts: PatchOptions = {}): LinesOutput {
  const P = buildPatch(image, lm, opts);
  const uv = lm.map((p) => P.frame.toUV(p));
  const U5 = uv[5].x, V5 = uv[5].y, U9 = uv[9].x, V9 = uv[9].y, U13 = uv[13].x, V13 = uv[13].y, U17 = uv[17].x, V17 = uv[17].y;
  const uUlnar = U17 + (U17 - U13) * 0.75;
  const pxPerW = P.w / (U1 - U0);

  // Heart line: distal transverse crease, over ring/little knuckles, toward index–middle gap.
  const hc = (u: number) => {
    const t = (u - U17) / (U9 - U17 || 1);
    return V17 - 0.02 + t * (V9 - 0.05 - (V17 - 0.02)) + (V13 - (V17 + V9) / 2) * 0.3;
  };
  const heartPts = traceHorizontal(P, uUlnar, U5 - 0.02, hc, 0.14);
  const heart = finish(P, 'heart', heartPts, 0.35);

  // Head line: proximal transverse crease, from the radial edge near the index knuckle, sloping to the ulnar side.
  const hdc = (u: number) => {
    const t = (u - (U5 + 0.12)) / (U17 + 0.05 - (U5 + 0.12) || 1);
    return V5 - 0.12 + t * (V17 - 0.3 - (V5 - 0.12));
  };
  const headPts = traceHorizontal(P, U17 + 0.05, U5 + 0.18, hdc, 0.15, nearPath(heartPts, 0.04 * pxPerW));
  const head = finish(P, 'head', headPts, 0.3);

  // Life line: thenar crease, arc around the thumb base.
  const C = P.pxAt(Math.max(uv[2].x - 0.02, 0.35), uv[2].y + 0.02);
  const S = P.pxAt(U5 - 0.02, V5 - 0.12);
  const E = P.pxAt(0.22, 0.02);
  const norm = (a: number) => { while (a < Math.PI / 2) a += 2 * Math.PI; while (a > 2.5 * Math.PI) a -= 2 * Math.PI; return a; };
  let a0 = norm(Math.atan2(S.y - C.y, S.x - C.x));
  let a1 = norm(Math.atan2(E.y - C.y, E.x - C.x));
  if (a0 > 1.5 * Math.PI) a0 -= 2 * Math.PI; // keep sweep through the ulnar (left) side
  if (a1 < a0) [a0, a1] = [a1, a0];
  const lifePts = traceArc(P, C, a0, a1, 0.25 * pxPerW, 0.9 * pxPerW);
  const life = finish(P, 'life', lifePts, 0.4);

  // Fate line: vertical crease in the centre of the palm (often faint or absent).
  const fc = (v: number) => 0.05 + (v / Math.max(V9, 0.5)) * ((U9 + U13) / 2 - 0.05);
  const fatePts = traceVertical(P, 0.1, Math.min(V9, V13) - 0.2, fc, 0.16, nearPath(lifePts, 0.04 * pxPerW));
  const fate = finish(P, 'fate', fatePts, 0.35, SNR_PRESENT + 0.8); // stricter: often faint or absent

  // Single transverse crease: heart line runs fully across to the radial side while the head line is weak.
  const heartReachesRadial = heart.present && heart.uv.some((p) => p.x > U9 + 0.25);
  const singleCrease = heartReachesRadial && (!head.present || head.clarity < 0.1) && heart.length > 1.0;

  return { lines: { heart, head, life, fate }, quality: measureQuality(P), singleCrease, patch: P };
}

/** Grayscale visualisation of the crease response ("what the AI sees"). */
export function responseImage(P: PalmPatch): ImageData {
  const out = new ImageData(P.w, P.h);
  for (let k = 0; k < P.w * P.h; k++) {
    const v = P.mask[k] ? Math.round(255 * Math.pow(P.resp[k], 0.7)) : 0;
    out.data[k * 4] = v * 0.6;
    out.data[k * 4 + 1] = v * 0.9;
    out.data[k * 4 + 2] = v;
    out.data[k * 4 + 3] = P.mask[k] ? 255 : 60;
  }
  return out;
}

/** Fast check for the live camera meter: how clearly the main creases show right now. */
export function liveCreaseScore(image: HTMLCanvasElement | ImageData, lm: Pt[]) {
  const o = detectPalmLines(image, lm, { patchW: 150 });
  const main = [o.lines.heart, o.lines.head, o.lines.life];
  const found = main.filter((l) => l.present).length;
  const score = main.reduce((s, l) => s + (l.present ? 0.25 + 0.75 * l.clarity : 0), 0) / 3;
  return { score, found, quality: o.quality };
}
