import type { T } from '../i18n';
import type { Analysis, HandSide, LineKey, Profile } from '../types';
import { ARCHETYPES, BARNUM, COUPLE_FEATURES, COUPLE_TYPES, ELEMENTS, TRADITION, coupleKey } from './knowledge';
import { clamp } from '../vision/geometry';

export interface LineReading {
  key: LineKey;
  present: boolean;
  tradition: T[];
}

export function readLines(a: Analysis): Record<LineKey, LineReading> {
  const { heart, head, life, fate } = a.lines;
  const uv5 = a.norm[5], uv9 = a.norm[9];
  const out = {} as Record<LineKey, LineReading>;

  const h: T[] = [];
  if (heart.present) {
    h.push(heart.length >= 1.0 ? TRADITION.heart.long : TRADITION.heart.short);
    h.push(heart.curvature >= 0.08 ? TRADITION.heart.curved : TRADITION.heart.straight);
    const endU = Math.max(...heart.uv.map((p) => p.x));
    const mid = (uv5.x + uv9.x) / 2;
    h.push(endU >= uv5.x - 0.08 ? TRADITION.heart.endIndex : endU >= mid - 0.12 ? TRADITION.heart.endBetween : TRADITION.heart.endMiddle);
  }
  out.heart = { key: 'heart', present: heart.present, tradition: h };

  const d: T[] = [];
  if (head.present) {
    d.push(head.length >= 1.1 ? TRADITION.head.long : TRADITION.head.short);
    const s = head.uv[0], e = head.uv[head.uv.length - 1];
    const slope = Math.abs(s.y - e.y) / Math.max(Math.abs(s.x - e.x), 0.1);
    d.push(head.curvature >= 0.07 || slope > 0.45 ? TRADITION.head.curved : TRADITION.head.straight);
    if (life.present) {
      const headStart = head.uv.reduce((m, p) => (p.x > m.x ? p : m));
      const lifeStart = life.uv.reduce((m, p) => (p.y > m.y ? p : m));
      d.push(Math.hypot(headStart.x - lifeStart.x, headStart.y - lifeStart.y) < 0.14 ? TRADITION.head.joined : TRADITION.head.separate);
    }
  }
  out.head = { key: 'head', present: head.present, tradition: d };

  const l: T[] = [];
  if (life.present) {
    const minU = Math.min(...life.uv.map((p) => p.x));
    l.push(life.curvature >= 0.15 || minU < 0.1 ? TRADITION.life.wide : TRADITION.life.close);
    l.push(life.clarity >= 0.6 ? TRADITION.life.deep : TRADITION.life.faint);
    l.push(TRADITION.life.note);
  }
  out.life = { key: 'life', present: life.present, tradition: l };

  out.fate = { key: 'fate', present: true, tradition: [fate.present ? TRADITION.fate.present : TRADITION.fate.absent] };
  return out;
}

export function archetypeName(a: { element: Analysis['element']; archetype: number }): T {
  return ARCHETYPES[a.element][a.archetype] ?? ARCHETYPES[a.element][0];
}

/** One sentence for share cards. */
export function highlight(a: Analysis): T {
  const r = readLines(a);
  return r.heart.tradition[1] ?? r.head.tradition[0] ?? ELEMENTS[a.element].tradition;
}

function hash(n: number) {
  let x = Math.floor(n * 1e6) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
}

/** Portrait for the Barnum experiment: 2 specific statements + 2 generic ones. */
export function portrait(a: Analysis): { text: T; barnum: boolean }[] {
  const r = readLines(a);
  const specific: T[] = [ELEMENTS[a.element].tradition];
  const firstLine = r.head.tradition[1] ?? r.heart.tradition[0] ?? r.life.tradition[0];
  if (firstLine) specific.push(firstLine);
  const h = hash(a.metrics.digitRatio + a.metrics.palmRatio);
  const i = h % BARNUM.length;
  const j = (i + 1 + (h % (BARNUM.length - 1))) % BARNUM.length;
  const items = [
    ...specific.map((text) => ({ text, barnum: false })),
    { text: BARNUM[i], barnum: true },
    { text: BARNUM[j === i ? (i + 2) % BARNUM.length : j], barnum: true },
  ];
  // deterministic interleave so generic lines are not always last
  return [items[2], items[0], items[3], items[1]].filter(Boolean);
}

// ------------------------------------------------------------- two hands

export interface HandsComparison {
  symmetry: number; // 0..100
  rows: { label: T; left: string; right: string; diff: number }[];
}

export function compareHands(left: Analysis, right: Analysis): HandsComparison {
  const f = (x: number, d = 2) => x.toFixed(d);
  const L = left.lines, R = right.lines;
  const rows: HandsComparison['rows'] = [
    { label: { vi: '2D:4D', en: '2D:4D' }, left: f(left.metrics.digitRatio, 3), right: f(right.metrics.digitRatio, 3), diff: Math.abs(left.metrics.digitRatio - right.metrics.digitRatio) / 0.03 },
    { label: { vi: 'Lòng bàn tay dài/rộng', en: 'Palm length/width' }, left: f(left.metrics.palmRatio), right: f(right.metrics.palmRatio), diff: Math.abs(left.metrics.palmRatio - right.metrics.palmRatio) / 0.1 },
    { label: { vi: 'Ngón giữa/lòng bàn tay', en: 'Middle finger/palm' }, left: f(left.metrics.fingerRatio), right: f(right.metrics.fingerRatio), diff: Math.abs(left.metrics.fingerRatio - right.metrics.fingerRatio) / 0.06 },
  ];
  const lineRow = (k: LineKey, name: T) => {
    const a = L[k], b = R[k];
    if (!a.present && !b.present) return;
    rows.push({
      label: name,
      left: a.present ? f(a.length) : '—',
      right: b.present ? f(b.length) : '—',
      diff: a.present && b.present ? Math.abs(a.length - b.length) / 0.2 + Math.abs(a.curvature - b.curvature) / 0.06 : 2,
    });
  };
  lineRow('heart', { vi: 'Tâm đạo (độ dài)', en: 'Heart line (length)' });
  lineRow('head', { vi: 'Trí đạo (độ dài)', en: 'Head line (length)' });
  lineRow('life', { vi: 'Sinh đạo (độ dài)', en: 'Life line (length)' });
  const mean = rows.reduce((s, r) => s + Math.min(r.diff, 3), 0) / rows.length;
  return { symmetry: Math.round(clamp(100 - mean * 22, 5, 99)), rows };
}

export function handMessage(a: Analysis, role: 'innate' | 'present'): T {
  const el = ELEMENTS[a.element].name;
  const arch = archetypeName(a);
  return role === 'innate'
    ? { vi: `Tay không thuận của bạn là ${el.vi}, kiểu ${arch.vi}: con người bạn mang theo từ khi sinh ra.`, en: `Your non-dominant hand (${el.en}, ${arch.en}) shows who you were born as.` }
    : { vi: `Tay thuận của bạn là ${el.vi}, kiểu ${arch.vi}: con người bạn đang sống hôm nay.`, en: `Your dominant hand (${el.en}, ${arch.en}) shows who you are living as today.` };
}

export const otherSide = (s: HandSide): HandSide => (s === 'left' ? 'right' : 'left');

// ----------------------------------------------------------------- couple

export interface CoupleReading {
  type: { name: T; story: T };
  alike: T[];
  complement: T[];
}

function featureValue(p: Profile, id: string): number | null {
  switch (id) {
    case 'heartCurv': return p.h[0] ? p.h[1] : null;
    case 'heartLen': return p.h[0] || null;
    case 'headLen': return p.d[0] || null;
    case 'headCurv': return p.d[0] ? p.d[1] : null;
    case 'lifeCurv': return p.l[0] ? p.l[1] : null;
    case 'palm': return p.pr;
    case 'fingers': return p.fr;
    case 'fate': return p.f;
    default: return null;
  }
}

export function readCouple(a: Profile, b: Profile): CoupleReading {
  const scored = COUPLE_FEATURES.map((f) => {
    const x = featureValue(a, f.id), y = featureValue(b, f.id);
    return x === null || y === null ? null : { f, z: Math.abs(x - y) / f.sd };
  }).filter((x): x is { f: (typeof COUPLE_FEATURES)[number]; z: number } => !!x);
  const asc = scored.slice().sort((p, q) => p.z - q.z);
  const alike = asc.slice(0, 3);
  const rest = asc.slice(3).sort((p, q) => q.z - p.z);
  const complement = rest.slice(0, 3);
  return {
    type: COUPLE_TYPES[coupleKey(a.e, b.e)],
    alike: alike.map((s) => s.f.alike),
    complement: complement.map((s) => s.f.complement),
  };
}
