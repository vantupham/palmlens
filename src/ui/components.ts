import { getLang, t, tr, type T } from '../i18n';
import type { Analysis, HandCapture, LineKey, Pt } from '../types';
import { ELEMENTS, LINE_INFO, SOURCES, TRAITS, DIGIT_RATIO_SCIENCE } from '../interpret/knowledge';
import { readLines, portrait } from '../interpret/reading';
import { LINE_COLORS, drawSkeleton, glowStroke } from '../render/draw';
import { type PalmPatch } from '../vision/palmlines';
import { distToSegment } from '../vision/geometry';
import { h, svg, toast } from './dom';
import { shareCanvas, type CardFormat } from '../share/card';

// ------------------------------------------------------------ hand viewer

export function handViewer(cap: HandCapture, a: Analysis, patch: PalmPatch, onLineClick?: (k: LineKey) => void) {
  const lm = cap.landmarks;
  const xs = lm.map((p) => p.x), ys = lm.map((p) => p.y);
  const pad = 0.16 * Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const x0 = Math.max(0, Math.min(...xs) - pad), y0 = Math.max(0, Math.min(...ys) - pad);
  const x1 = Math.min(cap.image.width, Math.max(...xs) + pad), y1 = Math.min(cap.image.height, Math.max(...ys) + pad);
  const cw = x1 - x0, ch = y1 - y0;
  const k = Math.min(1.5, 1000 / Math.max(cw, ch));
  const canvas = h('canvas', { width: Math.round(cw * k), height: Math.round(ch * k), role: 'img', 'aria-label': t('lines') }) as HTMLCanvasElement;
  const g = canvas.getContext('2d')!;
  const toC = (p: Pt): Pt => ({ x: (p.x - x0) * k, y: (p.y - y0) * k });
  const mirrored = cap.source === 'camera'; // show selfie captures the way the user saw them
  const layers = { skeleton: true, lines: true, ai: false };
  let aiImage: ImageData | null = null;

  function buildAI(): ImageData {
    const W = canvas.width, H = canvas.height;
    const out = g.createImageData(W, H);
    const f = patch.frame;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const uv = f.toUV({ x: x / k + x0, y: y / k + y0 });
        const p = patch.pxAt(uv.x, uv.y);
        const i = Math.round(p.x), j = Math.round(p.y);
        if (i < 0 || j < 0 || i >= patch.w || j >= patch.h) continue;
        const q = j * patch.w + i;
        if (!patch.mask[q]) continue;
        const v = Math.pow(patch.resp[q], 0.7);
        const o = (y * W + x) * 4;
        out.data[o] = 90 + 120 * v;
        out.data[o + 1] = 200 + 55 * v;
        out.data[o + 2] = 255;
        out.data[o + 3] = 40 + 215 * v;
      }
    return out;
  }

  function render(progress = 1) {
    g.save();
    if (mirrored) { g.translate(canvas.width, 0); g.scale(-1, 1); }
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(cap.image, x0, y0, cw, ch, 0, 0, canvas.width, canvas.height);
    g.fillStyle = layers.ai ? 'rgba(4,6,20,0.72)' : 'rgba(10,6,30,0.18)';
    g.fillRect(0, 0, canvas.width, canvas.height);
    if (layers.ai) {
      aiImage ??= buildAI();
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width; tmp.height = canvas.height;
      tmp.getContext('2d')!.putImageData(aiImage, 0, 0);
      g.drawImage(tmp, 0, 0);
    }
    const P = lm.map(toC);
    if (layers.skeleton) drawSkeleton(g, P, canvas.width / 700, 'rgba(255,255,255,0.8)', Math.min(1, progress / 0.35));
    if (layers.lines) {
      const order: LineKey[] = ['heart', 'head', 'life', 'fate'];
      order.forEach((key, i) => {
        const l = a.lines[key];
        if (!l.present) return;
        const start = 0.3 + i * 0.16;
        const pr = Math.max(0, Math.min(1, (progress - start) / 0.25));
        if (pr > 0) glowStroke(g, l.img.map(toC), LINE_COLORS[key], Math.max(3, canvas.width / 180), pr);
      });
    }
    g.restore();
  }

  // reveal animation
  const t0 = performance.now();
  const anim = () => {
    const p = (performance.now() - t0) / 2600;
    render(Math.min(1, p));
    if (p < 1) requestAnimationFrame(anim);
  };
  requestAnimationFrame(anim);

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    let cx = ((e.clientX - r.left) / r.width) * canvas.width;
    const cy = ((e.clientY - r.top) / r.height) * canvas.height;
    if (mirrored) cx = canvas.width - cx;
    let best: LineKey | null = null, bd = canvas.width * 0.05;
    for (const key of ['heart', 'head', 'life', 'fate'] as LineKey[]) {
      const pts = a.lines[key].present ? a.lines[key].img.map(toC) : [];
      for (let i = 1; i < pts.length; i++) {
        const d = distToSegment({ x: cx, y: cy }, pts[i - 1], pts[i]);
        if (d < bd) { bd = d; best = key; }
      }
    }
    if (best) onLineClick?.(best);
  });

  const toggle = (key: keyof typeof layers, label: string) => {
    const b = h('button', { 'aria-pressed': String(layers[key]) }, label);
    b.addEventListener('click', () => {
      layers[key] = !layers[key];
      b.setAttribute('aria-pressed', String(layers[key]));
      render(1);
      aiNote.hidden = !layers.ai;
    });
    return b;
  };
  const aiNote = h('p', { class: 'tiny', hidden: true }, t('aiSeesNote'));
  return h('div', { class: 'viewer-wrap' },
    h('div', { class: 'viewer' }, canvas, cap.source === 'demo' ? h('span', { class: 'tag badge' }, t('sampleBadge')) : null),
    h('div', { class: 'layers' }, toggle('skeleton', t('layerSkeleton')), toggle('lines', t('layerLines')), toggle('ai', '✨ ' + t('layerAI'))),
    aiNote,
  );
}

// ------------------------------------------------------------------ bits

export function srcLinks(ids: string[]) {
  return ids.map((id, i) => h('a', { class: 'src-link', href: SOURCES[id].url, target: '_blank', rel: 'noopener', title: SOURCES[id].label }, `[${i + 1}]`));
}

export function sourcesList(ids = Object.keys(SOURCES)) {
  return h('div', { class: 'card' },
    h('h3', null, t('sources')),
    h('ol', { class: 'sources' }, ids.map((id) => h('li', null, SOURCES[id].label, ' ', h('a', { href: SOURCES[id].url, target: '_blank', rel: 'noopener' }, '↗')))),
  );
}

export function confidenceMeter(a: Analysis) {
  const pct = Math.round(a.confidence * 100);
  return h('div', { class: 'small' },
    h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', { class: 'muted' }, t('confidence')), h('b', { class: 'mono' }, `${pct}%`)),
    h('div', { class: 'meter' }, h('i', { style: `width:${pct}%` })),
  );
}

export function qualityWarning(a: Analysis) {
  if (a.quality.ok) return null;
  const map = { dark: t('qDark'), bright: t('qBright'), blurry: t('qBlurry'), small: t('qSmall') } as const;
  return h('div', { class: 'card warn small' }, h('b', null, a.quality.issues.map((i) => map[i]).join(' · ')), h('div', { class: 'muted' }, t('qTip')));
}

export function shapeMap(a: Analysis) {
  const x = 160 + a.shapeScore.fingers * 120;
  const y = 160 - a.shapeScore.palm * 120;
  const lab = (k: keyof typeof ELEMENTS) => tr(ELEMENTS[k].name);
  const on = (k: string) => (a.element === k ? 'var(--accent)' : 'var(--ink3)');
  return h('div', { class: 'shape-map' }, svg(`
    <svg viewBox="0 0 320 340" role="img" aria-label="${t('shapeMap')}">
      <rect x="40" y="40" width="240" height="240" rx="14" fill="none" stroke="var(--card-b)"/>
      <line x1="160" y1="40" x2="160" y2="280" stroke="var(--card-b)" stroke-dasharray="4 4"/>
      <line x1="40" y1="160" x2="280" y2="160" stroke="var(--card-b)" stroke-dasharray="4 4"/>
      <text x="100" y="80" text-anchor="middle" font-size="13" font-weight="600" fill="${on('fire')}">${lab('fire')}</text>
      <text x="220" y="80" text-anchor="middle" font-size="13" font-weight="600" fill="${on('water')}">${lab('water')}</text>
      <text x="100" y="255" text-anchor="middle" font-size="13" font-weight="600" fill="${on('earth')}">${lab('earth')}</text>
      <text x="220" y="255" text-anchor="middle" font-size="13" font-weight="600" fill="${on('air')}">${lab('air')}</text>
      <text x="160" y="30" text-anchor="middle" font-size="11" fill="var(--ink3)">▲ ${t('longPalm')}</text>
      <text x="160" y="300" text-anchor="middle" font-size="11" fill="var(--ink3)">▼ ${t('squarePalm')}</text>
      <text x="40" y="320" font-size="11" fill="var(--ink3)">◀ ${t('shortFingers')}</text>
      <text x="280" y="320" text-anchor="end" font-size="11" fill="var(--ink3)">${t('longFingers')} ▶</text>
      <circle cx="${x}" cy="${y}" r="16" fill="var(--accent)" opacity="0.25"><animate attributeName="r" values="12;20;12" dur="2.4s" repeatCount="indefinite"/></circle>
      <circle cx="${x}" cy="${y}" r="7" fill="var(--accent)"/>
      <text x="${x}" y="${y - 14}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)">${t('you')}</text>
    </svg>`));
}

export function fingerBars(a: Analysis) {
  const f = a.metrics.fingerLen;
  const rows: [string, number][] = [[t('thumb'), f.thumb], [t('index'), f.index], [t('middle'), f.middle], [t('ring'), f.ring], [t('pinky'), f.pinky]];
  return h('div', { class: 'bars' }, rows.map(([name, v]) => {
    const pct = (v / f.middle) * 100;
    return h('div', { class: 'bar' }, h('span', null, name), h('div', { class: 'track' }, h('div', { class: 'fill', style: `width:${Math.min(100, pct)}%` })), h('span', { class: 'mono small' }, `${pct.toFixed(0)}%`));
  }));
}

function digitGauge(r: number) {
  const lo = 0.88, hi = 1.06;
  const x = 20 + ((Math.min(hi, Math.max(lo, r)) - lo) / (hi - lo)) * 280;
  return svg(`<svg viewBox="0 0 320 64" role="img" aria-label="2D:4D ${r.toFixed(3)}" style="width:100%;max-width:420px">
    <line x1="20" y1="34" x2="300" y2="34" stroke="var(--card-b)" stroke-width="6" stroke-linecap="round"/>
    ${[0.9, 0.95, 1.0, 1.05].map((v) => { const tx = 20 + ((v - lo) / (hi - lo)) * 280; return `<line x1="${tx}" y1="28" x2="${tx}" y2="40" stroke="var(--ink3)"/><text x="${tx}" y="58" font-size="10" text-anchor="middle" fill="var(--ink3)">${v.toFixed(2)}</text>`; }).join('')}
    <circle cx="${x}" cy="34" r="8" fill="var(--accent)"/>
    <text x="${x}" y="18" font-size="12" font-weight="700" text-anchor="middle" fill="var(--ink)">${r.toFixed(3)}</text>
  </svg>`);
}

export function measuresCard(a: Analysis) {
  const m = a.metrics;
  return h('div', { class: 'card stack sci' },
    h('div', { class: 'row', style: 'justify-content:space-between' }, h('h3', { style: 'margin:0' }, t('measures')), h('span', { class: 'tag' }, t('scienceTag'))),
    h('div', { class: 'stats' },
      stat(m.digitRatio.toFixed(3), '2D:4D'),
      stat(m.palmRatio.toFixed(2), t('palmRatio')),
      stat(m.fingerRatio.toFixed(2), t('fingerRatio')),
    ),
    h('div', null, h('div', { class: 'small muted' }, t('fingerLengths')), fingerBars(a)),
    h('div', null, h('div', { class: 'small muted' }, t('digitRatio')), digitGauge(m.digitRatio)),
    h('p', { class: 'small' }, tr(DIGIT_RATIO_SCIENCE), ' ', srcLinks(['manning98', 'honekopp10'])),
  );
}

function stat(v: string, k: string) {
  return h('div', { class: 'stat' }, h('div', { class: 'v' }, v), h('div', { class: 'k' }, k));
}

export function shapeCard(a: Analysis) {
  const el = ELEMENTS[a.element];
  return h('div', { class: 'card stack' },
    h('div', { class: 'row', style: 'justify-content:space-between' }, h('h3', { style: 'margin:0' }, `${el.icon} ${tr(el.name)}`), h('span', { class: 'tag sci' }, t('scienceTag')), h('span', { class: 'tag mys' }, t('mysticTag'))),
    h('div', { class: 'small muted' }, tr(el.shape)),
    shapeMap(a),
    h('p', { class: 'mys' }, tr(el.tradition)),
    h('p', { class: 'sci small' }, tr(el.science)),
  );
}

export function lineCards(a: Analysis) {
  const reading = readLines(a);
  return (['heart', 'head', 'life', 'fate'] as LineKey[]).map((key) => {
    const info = LINE_INFO[key];
    const l = a.lines[key];
    const r = reading[key];
    return h('div', { class: 'card line-card', id: `line-${key}`, style: `--c:${LINE_COLORS[key]}` },
      h('h3', null, h('span', null, tr(info.name)), h('small', null, tr(info.anatomy))),
      l.present
        ? h('div', { class: 'row small sci' },
            h('span', { class: 'pill mono' }, `L ${l.length.toFixed(2)}`),
            h('span', { class: 'pill mono' }, `κ ${l.curvature.toFixed(2)}`),
            h('span', { class: 'pill mono' }, `${Math.round(l.clarity * 100)}%`))
        : h('div', { class: 'small muted' }, t('notFound')),
      h('p', { class: 'sci small' }, tr(info.science), ' ', srcLinks(info.sources)),
      r.tradition.length ? h('ul', { class: 'mys' }, r.tradition.map((x) => h('li', null, tr(x)))) : null,
    );
  });
}

export function traitsCard(a: Analysis) {
  const items: { science: T; tradition: T; src?: string[] }[] = [];
  if (a.metrics.longPinky) items.push(TRAITS.longPinky);
  if (a.singleCrease) items.push({ ...TRAITS.singleCrease, src: ['medline'] });
  if (!items.length) return null;
  return h('div', { class: 'card stack' },
    h('h3', null, t('traits')),
    items.map((it) => h('div', null,
      h('p', { class: 'sci small' }, tr(it.science), ' ', it.src ? srcLinks(it.src) : null),
      h('p', { class: 'mys' }, tr(it.tradition)))),
  );
}

export function barnumCard(a: Analysis) {
  const items = portrait(a);
  let rating = 0;
  const list = h('ul', null, items.map((it) => h('li', null, tr(it.text))));
  const stars = h('div', { class: 'stars', role: 'radiogroup' });
  const reveal = h('button', { class: 'btn', disabled: true }, t('barnumReveal'));
  const result = h('div', { class: 'small' });
  for (let i = 1; i <= 5; i++) {
    const b = h('button', { 'aria-label': `${i}/5` }, '★');
    b.addEventListener('click', () => {
      rating = i;
      [...stars.children].forEach((s, j) => s.classList.toggle('on', j < i));
      reveal.removeAttribute('disabled');
    });
    stars.append(b);
  }
  reveal.addEventListener('click', () => {
    const vi = getLang() === 'vi';
    [...list.children].forEach((li, i) => {
      if (!items[i].barnum) return;
      li.classList.add('generic');
      li.append(h('span', { class: 'why' }, vi ? 'Câu Barnum: gần như ai đọc cũng thấy đúng' : 'Barnum statement: almost anyone feels it fits'));
    });
    result.replaceChildren(
      h('p', null, vi
        ? `Bạn chấm ${rating}/5. Hai trong bốn câu trên là câu "Barnum": chung chung đến mức gần như ai đọc cũng thấy đúng. Năm 1948, nhà tâm lý học Bertram Forer đưa cho cả lớp cùng một bản mô tả tính cách, nói rằng đó là kết quả riêng của từng người. Sinh viên chấm trung bình 4,26/5.`
        : `You rated it ${rating}/5. Two of the four lines above are "Barnum" statements, vague enough that nearly everyone feels they fit. In 1948 psychologist Bertram Forer gave his whole class the same personality sketch, presented as individual results. The average rating was 4.26 out of 5.`,
        ' ', srcLinks(['forer49'])),
      h('p', null, h('b', null, rating >= 4
        ? (vi ? 'Bạn vừa trải nghiệm đúng điều sinh viên của Forer đã trải qua.' : 'You just experienced exactly what Forer’s students did.')
        : (vi ? 'Bạn hoài nghi hơn phần lớn mọi người. Tinh thần khoa học đấy!' : 'You are more skeptical than most people. Very scientific!'))),
    );
    reveal.remove();
  });
  return h('div', { class: 'card stack barnum mys' },
    h('div', { class: 'row', style: 'justify-content:space-between' }, h('h3', { style: 'margin:0' }, t('portrait')), h('span', { class: 'tag' }, 'EXPERIMENT')),
    list,
    h('div', null, h('b', null, t('barnumTitle')), h('div', { class: 'tiny' }, t('barnumAsk'))),
    stars, reveal, result,
  );
}


// ----------------------------------------------------------- share modal

export function openShareModal(make: (f: CardFormat) => HTMLCanvasElement, filename: string, text: string, url: string) {
  let fmt: CardFormat = 'story';
  const img = h('img', { alt: '' }) as HTMLImageElement;
  const draw = () => (img.src = make(fmt).toDataURL('image/png'));
  const seg = h('div', { class: 'seg' });
  (['story', 'square'] as CardFormat[]).forEach((f) => {
    const b = h('button', { 'aria-pressed': String(f === fmt) }, f === 'story' ? '9:16' : '1:1');
    b.addEventListener('click', () => { fmt = f; [...seg.children].forEach((c) => c.setAttribute('aria-pressed', String(c === b))); draw(); });
    seg.append(b);
  });
  const close = () => modal.remove();
  const modal = h('div', { class: 'modal', onclick: (e: Event) => { if (e.target === modal) close(); } },
    h('div', { class: 'sheet stack' },
      h('div', { class: 'row', style: 'justify-content:space-between' }, seg, h('button', { class: 'btn ghost', onclick: close }, '✕')),
      img,
      h('div', { class: 'row', style: 'justify-content:center' },
        h('button', { class: 'btn primary', onclick: async () => { const r = await shareCanvas(make(fmt), filename, text, url); if (r === 'downloaded') toast(t('download') + ' ✓'); } }, t('share')),
        h('button', { class: 'btn', onclick: () => { make(fmt).toBlob((b) => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = filename; a.click(); }); } }, t('download')),
      ),
    ),
  );
  document.body.append(modal);
  draw();
}
