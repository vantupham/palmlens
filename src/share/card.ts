import { tr, t } from '../i18n';
import type { Analysis, Profile } from '../types';
import { ELEMENTS } from '../interpret/knowledge';
import { archetypeName, highlight, type CoupleReading } from '../interpret/reading';
import { drawStylizedHand, linesFromAnalysis, linesFromProfile, normFromProfile, starfield } from '../render/draw';

export type CardFormat = 'story' | 'square';

const GOLD = '#e8c372';
const SITE = 'vantupham.github.io/palmlens';

function base(format: CardFormat) {
  const W = 1080, H = format === 'story' ? 1920 : 1080;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1b1440');
  bg.addColorStop(0.55, '#0e0b1f');
  bg.addColorStop(1, '#06050d');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const halo = g.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.42, W * 0.6);
  halo.addColorStop(0, 'rgba(140,100,255,0.28)');
  halo.addColorStop(1, 'rgba(140,100,255,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, W, H);
  starfield(g, W, H, 11, format === 'story' ? 180 : 110);
  g.textAlign = 'center';
  g.fillStyle = GOLD;
  g.font = '600 34px ui-sans-serif, system-ui, sans-serif';
  g.letterSpacing = '8px';
  g.fillText('PALMLENS AI', W / 2, format === 'story' ? 120 : 80);
  g.letterSpacing = '0px';
  return { c, g, W, H };
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines = 4) {
  const words = text.split(' ');
  let line = '';
  let n = 0;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y + n * lh);
      line = w;
      if (++n >= maxLines) return y + n * lh;
    } else line = test;
  }
  if (line) g.fillText(line, x, y + n * lh);
  return y + (n + 1) * lh;
}

function footer(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.font = '400 26px ui-sans-serif, system-ui, sans-serif';
  g.fillText(t('mysticNote'), W / 2, H - 110);
  g.fillStyle = GOLD;
  g.font = '600 32px ui-sans-serif, system-ui, sans-serif';
  g.fillText(SITE, W / 2, H - 60);
}

function pill(g: CanvasRenderingContext2D, x: number, y: number, label: string, value: string, w: number) {
  g.save();
  g.fillStyle = 'rgba(255,255,255,0.06)';
  g.strokeStyle = 'rgba(232,195,114,0.35)';
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(x - w / 2, y, w, 120, 24);
  g.fill();
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.font = '400 24px ui-sans-serif, system-ui, sans-serif';
  g.fillText(label, x, y + 42);
  g.fillStyle = '#fff';
  g.font = '600 40px ui-monospace, SFMono-Regular, Menlo, monospace';
  g.fillText(value, x, y + 92);
  g.restore();
}

export function singleCard(a: Analysis, format: CardFormat): HTMLCanvasElement {
  const { c, g, W, H } = base(format);
  const story = format === 'story';
  const handY = story ? 760 : 470;
  const size = story ? 300 : 190;
  drawStylizedHand(g, a.norm, linesFromAnalysis(a), { cx: W / 2, cy: handY, size, aspect: a.metrics.palmRatio, mirror: a.side === 'left' });
  const el = ELEMENTS[a.element];
  let y = story ? 1290 : 840;
  g.fillStyle = GOLD;
  g.font = '600 30px ui-sans-serif, system-ui, sans-serif';
  g.fillText(`${el.icon}  ${tr(el.name).toUpperCase()}`, W / 2, y);
  g.fillStyle = '#fff';
  g.font = `700 ${story ? 80 : 64}px Georgia, 'Times New Roman', serif`;
  g.fillText(tr(archetypeName(a)), W / 2, y + (story ? 95 : 78));
  if (story) {
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.font = 'italic 400 36px Georgia, serif';
    y = wrap(g, `“${tr(highlight(a))}”`, W / 2, y + 175, 860, 50, 3);
    const top = y + 30;
    pill(g, W / 2 - 300, top, '2D:4D', a.metrics.digitRatio.toFixed(3), 260);
    pill(g, W / 2, top, t('palmShort'), a.metrics.palmRatio.toFixed(2), 260);
    pill(g, W / 2 + 300, top, t('linesFound'), String(['heart', 'head', 'life', 'fate'].filter((k) => a.lines[k as 'heart'].present).length), 260);
  }
  footer(g, W, H);
  return c;
}

export function bothCard(left: Analysis, right: Analysis, symmetry: number, format: CardFormat): HTMLCanvasElement {
  const { c, g, W, H } = base(format);
  const story = format === 'story';
  const y = story ? 720 : 460;
  const size = story ? 210 : 150;
  drawStylizedHand(g, left.norm, linesFromAnalysis(left), { cx: W / 2 - (story ? 250 : 230), cy: y, size, aspect: left.metrics.palmRatio, mirror: true });
  drawStylizedHand(g, right.norm, linesFromAnalysis(right), { cx: W / 2 + (story ? 250 : 230), cy: y, size, aspect: right.metrics.palmRatio, mirror: false });
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.font = '400 30px ui-sans-serif, system-ui, sans-serif';
  const ly = story ? 1130 : 760;
  g.fillText(t('leftHand'), W / 2 - 250, ly);
  g.fillText(t('rightHand'), W / 2 + 250, ly);
  g.fillStyle = GOLD;
  g.font = '600 30px ui-sans-serif, system-ui, sans-serif';
  g.fillText(t('symmetry').toUpperCase(), W / 2, ly + (story ? 150 : 90));
  g.fillStyle = '#fff';
  g.font = `700 ${story ? 150 : 96}px ui-monospace, Menlo, monospace`;
  g.fillText(`${symmetry}%`, W / 2, ly + (story ? 300 : 190));
  if (story) {
    g.font = '600 34px ui-sans-serif, system-ui, sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillText(`${tr(ELEMENTS[left.element].name)} · ${tr(ELEMENTS[right.element].name)}`, W / 2, ly + 390);
  }
  footer(g, W, H);
  return c;
}

export function coupleCard(a: Profile, b: Profile, reading: CoupleReading, format: CardFormat): HTMLCanvasElement {
  const { c, g, W, H } = base(format);
  const story = format === 'story';
  const y = story ? 700 : 440;
  const size = story ? 220 : 150;
  // two hands reaching toward each other
  drawStylizedHand(g, normFromProfile(a), linesFromProfile(a), { cx: W / 2 - (story ? 190 : 170), cy: y, size, aspect: a.pr, mirror: true, rotate: 0.32 });
  drawStylizedHand(g, normFromProfile(b), linesFromProfile(b), { cx: W / 2 + (story ? 190 : 170), cy: y, size, aspect: b.pr, mirror: false, rotate: -0.32 });
  // heart between
  g.save();
  g.translate(W / 2, story ? 330 : 190);
  g.fillStyle = '#ff5c8a';
  g.shadowColor = '#ff5c8a';
  g.shadowBlur = 30;
  g.beginPath();
  const s = story ? 1.6 : 1.1;
  g.moveTo(0, 18 * s);
  g.bezierCurveTo(-40 * s, -10 * s, -18 * s, -42 * s, 0, -22 * s);
  g.bezierCurveTo(18 * s, -42 * s, 40 * s, -10 * s, 0, 18 * s);
  g.fill();
  g.restore();
  let ty = story ? 1150 : 770;
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.font = '600 40px ui-sans-serif, system-ui, sans-serif';
  g.fillText(`${a.n || 'A'}  ♥  ${b.n || 'B'}`, W / 2, ty);
  g.fillStyle = GOLD;
  g.font = '600 30px ui-sans-serif, system-ui, sans-serif';
  g.fillText(t('coupleType').toUpperCase(), W / 2, ty + (story ? 110 : 70));
  g.fillStyle = '#fff';
  g.font = `700 ${story ? 96 : 70}px Georgia, serif`;
  g.fillText(tr(reading.type.name), W / 2, ty + (story ? 210 : 145));
  if (story) {
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.font = 'italic 400 36px Georgia, serif';
    ty = wrap(g, tr(reading.type.story), W / 2, ty + 300, 860, 50, 3);
    g.font = '400 30px ui-sans-serif, system-ui, sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.7)';
    wrap(g, `✦ ${tr(reading.alike[0] ?? reading.type.story)}`, W / 2, ty + 40, 860, 44, 3);
  }
  footer(g, W, H);
  return c;
}

export async function shareCanvas(c: HTMLCanvasElement, filename: string, text: string, url: string): Promise<'shared' | 'downloaded'> {
  const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: `${text} ${url}` });
      return 'shared';
    } catch {
      /* user cancelled or not allowed → fall back to download */
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
