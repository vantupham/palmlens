/**
 * 6-second vertical videos (1080×1920) recorded from a canvas animation with
 * MediaRecorder — no server, no upload. MP4 where the browser can encode it
 * (Safari, recent Chrome), otherwise WebM.
 */
import { tr, t as tt } from '../i18n';
import type { Analysis, Profile } from '../types';
import { ELEMENTS } from '../interpret/knowledge';
import { archetypeName, highlight, type CoupleReading } from '../interpret/reading';
import { drawStylizedHand, linesFromAnalysis, linesFromProfile, normFromProfile, starfield } from '../render/draw';

export type FrameFn = (g: CanvasRenderingContext2D, t: number) => void; // t in seconds

const W = 1080, H = 1920, DURATION = 6;
const GOLD = '#e8c372';
const ease = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a));

export function pickMime(): { mime: string; ext: 'mp4' | 'webm' } | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates: [string, 'mp4' | 'webm'][] = [
    ['video/mp4;codecs=avc1.42E01E', 'mp4'],
    ['video/mp4', 'mp4'],
    ['video/webm;codecs=vp9', 'webm'],
    ['video/webm;codecs=vp8', 'webm'],
    ['video/webm', 'webm'],
  ];
  for (const [mime, ext] of candidates) if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  return null;
}

export async function recordVideo(frame: FrameFn, onProgress?: (p: number) => void): Promise<{ blob: Blob; ext: string }> {
  const fmt = pickMime();
  if (!fmt) throw new Error('MediaRecorder unsupported');
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  frame(g, 0);
  const stream = c.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: fmt.mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((res) => (rec.onstop = () => res()));
  rec.start(250);
  const t0 = performance.now();
  await new Promise<void>((res) => {
    const step = () => {
      const tt = (performance.now() - t0) / 1000;
      frame(g, Math.min(tt, DURATION));
      onProgress?.(Math.min(1, tt / DURATION));
      if (tt < DURATION + 0.15) requestAnimationFrame(step);
      else res();
    };
    requestAnimationFrame(step);
  });
  rec.stop();
  await done;
  stream.getTracks().forEach((tr) => tr.stop());
  return { blob: new Blob(chunks, { type: fmt.mime.split(';')[0] }), ext: fmt.ext };
}

// ---------------------------------------------------------------- scenes

function background(g: CanvasRenderingContext2D, t: number) {
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1b1440');
  bg.addColorStop(0.55, '#0e0b1f');
  bg.addColorStop(1, '#06050d');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const halo = g.createRadialGradient(W / 2, 760, 40, W / 2, 760, 700 + 40 * Math.sin(t * 2));
  halo.addColorStop(0, 'rgba(140,100,255,0.32)');
  halo.addColorStop(1, 'rgba(140,100,255,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, W, H);
  g.save();
  g.translate(0, -t * 12);
  starfield(g, W, H + 120, 11, 180);
  g.restore();
  g.textAlign = 'center';
  g.globalAlpha = seg(t, 0, 0.6);
  g.fillStyle = GOLD;
  g.font = '600 34px ui-sans-serif, system-ui, sans-serif';
  g.letterSpacing = '8px';
  g.fillText('PALMLENS AI', W / 2, 130);
  g.letterSpacing = '0px';
  g.globalAlpha = 1;
}

function scanBeam(g: CanvasRenderingContext2D, t: number, a: number, b: number, yTop: number, yBot: number) {
  if (t < a || t > b) return;
  const y = yBot - (yBot - yTop) * ((t - a) / (b - a));
  const grad = g.createLinearGradient(0, y - 70, 0, y + 6);
  grad.addColorStop(0, 'rgba(125,255,168,0)');
  grad.addColorStop(1, 'rgba(125,255,168,0.45)');
  g.fillStyle = grad;
  g.fillRect(140, y - 70, W - 280, 76);
  g.fillStyle = 'rgba(180,255,210,0.9)';
  g.fillRect(140, y, W - 280, 3);
}

function footer(g: CanvasRenderingContext2D, t: number) {
  g.globalAlpha = seg(t, 0.2, 0.8);
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.font = '400 26px ui-sans-serif, system-ui, sans-serif';
  g.fillText(tt('mysticNote'), W / 2, H - 110);
  g.fillStyle = GOLD;
  g.font = '600 34px ui-sans-serif, system-ui, sans-serif';
  g.fillText('vantupham.github.io/palmlens', W / 2, H - 60);
  g.globalAlpha = 1;
}

function wrapText(g: CanvasRenderingContext2D, text: string, y: number, maxW: number, lh: number) {
  const words = text.split(' ');
  let line = '', n = 0;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) { g.fillText(line, W / 2, y + n++ * lh); line = w; }
    else line = test;
  }
  if (line) g.fillText(line, W / 2, y + n * lh);
}

/** AI scans one hand: skeleton fades in, beam sweeps, lines draw, the reading appears. */
export function singleScene(a: Analysis): FrameFn {
  const lines = linesFromAnalysis(a);
  const el = ELEMENTS[a.element];
  const quote = tr(highlight(a));
  return (g, t) => {
    background(g, t);
    const appear = seg(t, 0.2, 1.2);
    g.globalAlpha = appear;
    const bob = Math.sin(t * 1.6) * 6;
    drawStylizedHand(g, a.norm, lines, { cx: W / 2, cy: 760 + bob, size: 300 + 10 * appear, aspect: a.metrics.palmRatio, mirror: a.side === 'left', progress: seg(t, 2.0, 3.8), showLines: t > 2.0 });
    g.globalAlpha = 1;
    scanBeam(g, t, 0.9, 2.3, 280, 1180);
    g.textAlign = 'center';
    g.globalAlpha = seg(t, 3.4, 4.0);
    g.fillStyle = GOLD;
    g.font = '600 32px ui-sans-serif, system-ui, sans-serif';
    g.fillText(`${el.icon}  ${tr(el.name).toUpperCase()}`, W / 2, 1300);
    g.globalAlpha = seg(t, 3.7, 4.4);
    g.fillStyle = '#fff';
    g.font = '700 88px Georgia, serif';
    g.fillText(tr(archetypeName(a)), W / 2, 1405 + 20 * (1 - seg(t, 3.7, 4.4)));
    g.globalAlpha = seg(t, 4.4, 5.1);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.font = 'italic 400 38px Georgia, serif';
    wrapText(g, `“${quote}”`, 1500, 860, 52);
    g.globalAlpha = 1;
    footer(g, t);
  };
}

/** Two hands glide in, their lines light up, a heart pops, the couple type appears. */
export function coupleScene(pa: Profile, pb: Profile, r: CoupleReading): FrameFn {
  const na = normFromProfile(pa), nb = normFromProfile(pb);
  const la = linesFromProfile(pa), lb = linesFromProfile(pb);
  return (g, t) => {
    background(g, t);
    const slide = seg(t, 0.2, 2.0);
    const lp = seg(t, 1.6, 3.2);
    drawStylizedHand(g, na, la, { cx: W / 2 - 520 + 330 * slide, cy: 780, size: 230, aspect: pa.pr, mirror: true, rotate: 0.32 * slide, progress: lp, showLines: t > 1.6, lineColor: '#ff5c8a', edge: 'rgba(255,92,138,0.9)', fill: 'rgba(255,92,138,0.08)' });
    drawStylizedHand(g, nb, lb, { cx: W / 2 + 520 - 330 * slide, cy: 780, size: 230, aspect: pb.pr, mirror: false, rotate: -0.32 * slide, progress: lp, showLines: t > 1.6, lineColor: '#ffb35c', edge: 'rgba(255,179,92,0.9)', fill: 'rgba(255,179,92,0.08)' });
    // heart pop
    const hp = seg(t, 3.0, 3.6);
    if (hp > 0) {
      const s = 1.8 * hp * (1 + 0.06 * Math.sin(t * 6));
      g.save();
      g.translate(W / 2, 360);
      g.scale(s, s);
      g.fillStyle = '#ff5c8a';
      g.shadowColor = '#ff5c8a';
      g.shadowBlur = 30;
      g.beginPath();
      g.moveTo(0, 18);
      g.bezierCurveTo(-40, -10, -18, -42, 0, -22);
      g.bezierCurveTo(18, -42, 40, -10, 0, 18);
      g.fill();
      g.restore();
    }
    g.textAlign = 'center';
    g.globalAlpha = seg(t, 3.4, 4.0);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.font = '600 44px ui-sans-serif, system-ui, sans-serif';
    g.fillText(`${pa.n || 'A'}  ♥  ${pb.n || 'B'}`, W / 2, 1250);
    g.globalAlpha = seg(t, 3.8, 4.4);
    g.fillStyle = GOLD;
    g.font = '600 32px ui-sans-serif, system-ui, sans-serif';
    g.fillText(tt('coupleType').toUpperCase(), W / 2, 1350);
    g.fillStyle = '#fff';
    g.font = '700 100px Georgia, serif';
    g.fillText(tr(r.type.name), W / 2, 1460 + 20 * (1 - seg(t, 3.8, 4.4)));
    g.globalAlpha = seg(t, 4.5, 5.2);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.font = 'italic 400 38px Georgia, serif';
    wrapText(g, tr(r.type.story), 1560, 860, 52);
    g.globalAlpha = 1;
    footer(g, t);
  };
}

