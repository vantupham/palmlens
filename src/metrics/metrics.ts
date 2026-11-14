import type { ElementKey, LineResult, LineKey, Metrics, Pt } from '../types';
import { clamp, dist, dist3, palmFrame } from '../vision/geometry';

const chain = (p: Pt[], idx: readonly number[], d: (a: Pt, b: Pt) => number) => {
  let s = 0;
  for (let i = 1; i < idx.length; i++) s += d(p[idx[i - 1]], p[idx[i]]);
  return s;
};

/**
 * Hand measurements. Uses MediaPipe's metric 3D "world" landmarks when available
 * (less sensitive to perspective), otherwise the 2D image landmarks.
 * Finger length = knuckle (MCP) → fingertip along the joint chain. This is an
 * approximation of the anthropometric method (basal crease → tip), so absolute
 * values differ from caliper studies; ratios are comparable within this app.
 */
export function computeMetrics(lm: Pt[], world: Pt[] | null): Metrics {
  const useWorld = !!world && world.length === 21;
  const p = useWorld ? world! : lm;
  const d = useWorld ? dist3 : dist;
  const fingerLen = {
    thumb: chain(p, [1, 2, 3, 4], d),
    index: chain(p, [5, 6, 7, 8], d),
    middle: chain(p, [9, 10, 11, 12], d),
    ring: chain(p, [13, 14, 15, 16], d),
    pinky: chain(p, [17, 18, 19, 20], d),
  };
  const palmLength = d(p[0], p[9]);
  const palmWidth = d(p[5], p[17]);
  const f = palmFrame(lm);
  const v20 = f.toUV(lm[20]).y;
  const v15 = f.toUV(lm[15]).y;
  return {
    fingerLen,
    palmLength,
    palmWidth,
    digitRatio: fingerLen.index / fingerLen.ring,
    palmRatio: palmLength / palmWidth,
    fingerRatio: fingerLen.middle / palmLength,
    thumbRatio: fingerLen.thumb / fingerLen.index,
    longPinky: v20 > v15,
    indexLonger: fingerLen.index > fingerLen.ring,
  };
}

// Reference points for the shape map. These are initial estimates for
// MediaPipe-based measurements and should be recalibrated with beta data
// (see METHODOLOGY.md).
export const PALM_RATIO_MID = 1.42;
export const FINGER_RATIO_MID = 0.92;

/** Traditional four hand shapes from palm proportion × finger length. */
export function classifyElement(m: Metrics): { element: ElementKey; palm: number; fingers: number } {
  const palm = clamp((m.palmRatio - PALM_RATIO_MID) / 0.18, -1, 1); // + = long palm
  const fingers = clamp((m.fingerRatio - FINGER_RATIO_MID) / 0.12, -1, 1); // + = long fingers
  let element: ElementKey;
  if (palm <= 0 && fingers <= 0) element = 'earth';
  else if (palm <= 0) element = 'air';
  else if (fingers > 0) element = 'water';
  else element = 'fire';
  return { element, palm, fingers };
}

/** Which crease dominates (0 heart, 1 head, 2 life) — used for 12 archetypes. */
export function dominantLine(lines: Record<LineKey, LineResult>): number {
  const score = (l: LineResult) => (l.present ? l.clarity * 0.6 + Math.min(l.length, 1.5) * 0.4 : 0);
  const s = [score(lines.heart), score(lines.head), score(lines.life)];
  return s.indexOf(Math.max(...s));
}
