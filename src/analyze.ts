import type { Analysis, HandCapture, Profile } from './types';
import { computeMetrics, classifyElement, dominantLine } from './metrics/metrics';
import { detectPalmLines, type PalmPatch } from './vision/palmlines';
import { palmFrame, clamp } from './vision/geometry';
import { resample } from './render/draw';

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
