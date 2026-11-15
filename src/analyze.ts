import type { Analysis, HandCapture, Profile } from './types';
import { computeMetrics, classifyElement, dominantLine } from './metrics/metrics';
import type { LineKey, Pt } from './types';
import { curvature, polylineLength } from './vision/geometry';
import { smoothCurve } from './render/draw';
import { detectPalmLines, type PalmPatch } from './vision/palmlines';
import { palmFrame, clamp } from './vision/geometry';
import { resample } from './render/draw';
export { resample };

export interface AnalysisResult {
  analysis: Analysis;
  patch: PalmPatch;
}

export function analyzeHand(cap: HandCapture): AnalysisResult {
  const metrics = computeMetrics(cap.landmarks, cap.world);
  const { lines, quality, singleCrease, patch } = detectPalmLines(cap.image, cap.landmarks);
  const shape = classifyElement(metrics);
  const f = palmFrame(cap.landmarks);
  const norm = cap.landmarks.map((p) => f.toUV(p));
  const main = [lines.heart, lines.head, lines.life];
  const lineConf = main.reduce((a, l) => a + (l.present ? l.clarity : 0), 0) / 3;
  const qConf = quality.ok ? 1 : Math.max(0.3, 1 - 0.25 * quality.issues.length);
  return {
    analysis: {
      side: cap.side,
      source: cap.source,
      metrics,
      lines,
      quality,
      element: shape.element,
      shapeScore: { palm: shape.palm, fingers: shape.fingers },
      archetype: dominantLine(lines),
      singleCrease,
      confidence: clamp(0.35 * qConf + 0.65 * Math.min(1, lineConf * 1.6)),
      norm,
    },
    patch,
  };
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

export function toProfile(a: Analysis, name: string, sex?: 'm' | 'f'): Profile {
  const L = (k: 'heart' | 'head' | 'life'): [number, number, number] => {
    const l = a.lines[k];
    return l.present ? [r2(l.length), r2(l.curvature), r2(l.clarity)] : [0, 0, 0];
  };
  return {
    n: name.slice(0, 24),
    s: a.side,
    e: a.element,
    a: a.archetype,
    r: r3(a.metrics.digitRatio),
    pr: r2(a.metrics.palmRatio),
    fr: r2(a.metrics.fingerRatio),
    h: L('heart'),
    d: L('head'),
    l: L('life'),
    f: a.lines.fate.present ? r2(a.lines.fate.clarity) : 0,
    k: a.norm.flatMap((p) => [r2(p.x), r2(p.y)]),
    ln: (['heart', 'head', 'life'] as const).map((k) => (a.lines[k].present ? resample(a.lines[k].uv, 8).flatMap((p) => [r2(p.x), r2(p.y)]) : [])),
    ...(sex ? { g: sex } : {}),
  };
}

/** Starting shapes (palm coordinates) for a line the detector missed. */
export const LINE_TEMPLATES: Record<LineKey, Pt[]> = {
  heart: [{ x: -0.62, y: 0.7 }, { x: -0.3, y: 0.76 }, { x: 0, y: 0.82 }, { x: 0.22, y: 0.92 }],
  head: [{ x: 0.5, y: 0.74 }, { x: 0.15, y: 0.64 }, { x: -0.2, y: 0.54 }, { x: -0.5, y: 0.44 }],
  life: [{ x: 0.48, y: 0.72 }, { x: 0.22, y: 0.56 }, { x: 0.14, y: 0.32 }, { x: 0.2, y: 0.06 }],
  fate: [{ x: 0.05, y: 0.08 }, { x: 0.04, y: 0.3 }, { x: 0.03, y: 0.52 }, { x: 0.02, y: 0.7 }],
};

/**
 * Apply a hand correction. `ctrl` are control points in image pixels; null means
 * "my hand does not have this line". Measurements and the archetype are recomputed;
 * clarity is still measured from the photo so the science layer stays honest.
 */
export function applyLineEdit(res: AnalysisResult, key: LineKey, ctrl: Pt[] | null) {
  const a = res.analysis;
  const P = res.patch;
  const f = P.frame;
  if (!ctrl || ctrl.length < 2) {
    a.lines[key] = { key, img: [], uv: [], length: 0, curvature: 0, clarity: 0, present: false, edited: true };
  } else {
    const img = smoothCurve(ctrl, 8);
    const uv = img.map((p) => f.toUV(p));
    const aspect = f.L / f.W;
    const phys = uv.map((p) => ({ x: p.x, y: p.y * aspect }));
    let s = 0;
    for (const q of uv) {
      const px = P.pxAt(q.x, q.y);
      const i = Math.round(px.x), j = Math.round(px.y);
      if (i >= 0 && j >= 0 && i < P.w && j < P.h) s += P.resp[j * P.w + i];
    }
    a.lines[key] = { key, img, uv, length: polylineLength(phys), curvature: curvature(phys), clarity: clamp(s / uv.length), present: true, edited: true };
  }
  a.archetype = dominantLine(a.lines);
  if (key === 'head' && a.lines.head.present) a.singleCrease = false;
}
