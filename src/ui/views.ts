import { t, tr, getLang } from '../i18n';
import type { Analysis, HandCapture, HandSide, LineKey, Profile } from '../types';
import { analyzeHand, toProfile, type AnalysisResult } from '../analyze';
import { ELEMENTS } from '../interpret/knowledge';
import { archetypeName, compareHands, handMessage, otherSide, readCouple } from '../interpret/reading';
import { drawStylizedHand, linesFromAnalysis, linesFromProfile, normFromProfile, LINE_COLORS, smoothCurve, starfield } from '../render/draw';
import { bothCard, coupleCard, singleCard } from '../share/card';
import { coupleHash, coupleUrl, inviteUrl, siteUrl } from '../share/codec';
import { captureHand } from './capture';
import { barnumCard, confidenceMeter, handViewer, lineCards, measuresCard, openShareModal, qualityWarning, shapeCard, sourcesList, srcLinks, traitsCard } from './components';
import { h, mount, toast } from './dom';
import type { Pt } from '../types';

export const nav = {
  home: () => {},
  showLayerSwitch: (_on: boolean) => {},
};

function analyzing(): Promise<void> {
  mount(h('div', { class: 'center fade-in', style: 'padding:80px 0' }, h('div', { class: 'spinner' }), h('p', null, t('analyzing'))));
  return new Promise((r) => setTimeout(r, 60));
}

async function runAnalysis(cap: HandCapture): Promise<AnalysisResult> {
  await analyzing();
  return analyzeHand(cap);
}

// ================================================================ single

export async function startSingle() {
  const cap = await captureHand({ title: t('modeSingle'), subtitle: t('modeSingleDesc') });
  if (!cap) return nav.home();
  showSingle(cap, await runAnalysis(cap));
}

export function showSingle(cap: HandCapture, res: AnalysisResult) {
  const a = res.analysis;
  nav.showLayerSwitch(true);
  const flash = (k: LineKey) => {
    const el = document.getElementById(`line-${k}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.classList.remove('flash');
    void el?.offsetWidth;
    el?.classList.add('flash');
  };
  const sideToggle = h('div', { class: 'row small' }, h('span', { class: 'muted' }, t('whichHand')),
    ...(['left', 'right'] as HandSide[]).map((s) => h('button', {
      class: 'btn ghost', style: 'padding:6px 12px', 'aria-pressed': String(a.side === s),
      onclick: () => { cap.side = s; a.side = s; showSingle(cap, res); },
    }, (a.side === s ? '● ' : '○ ') + (s === 'left' ? t('leftHand') : t('rightHand')))));
  const el = ELEMENTS[a.element];
  mount(
    h('section', { class: 'result fade-in' },
      h('div', null, handViewer(cap, a, res.patch, flash), h('div', { class: 'stack', style: 'margin-top:12px' }, qualityWarning(a), sideToggle)),
      h('div', { class: 'stack' },
        h('div', { class: 'headline' },
          h('div', { class: 'el' }, `${el.icon} ${tr(el.name).toUpperCase()}`),
          h('h1', { class: 'mys' }, tr(archetypeName(a))),
          h('h1', { class: 'sci' }, getLang() === 'vi' ? 'Hồ sơ đo đạc bàn tay' : 'Hand measurement profile'),
          h('p', { class: 'mys tiny' }, t('mysticNote')),
        ),
        confidenceMeter(a),
        shapeCard(a),
        measuresCard(a),
        h('h2', { style: 'margin-top:18px' }, t('lines')),
        h('p', { class: 'tiny' }, getLang() === 'vi' ? 'Chạm vào một đường chỉ trên ảnh để xem giải thích.' : 'Tap a line on the photo to jump to its card.'),
        ...lineCards(a),
        traitsCard(a),
        barnumCard(a),
        actions([
          h('button', { class: 'btn primary', onclick: () => openShareModal((f) => singleCard(a, f), 'palmlens.png', tr(archetypeName(a)), siteUrl()) }, '✦ ', t('makeCard')),
          h('button', { class: 'btn', onclick: () => continueBoth(cap, res) }, '🤚 ', t('scanOther')),
          h('button', { class: 'btn', onclick: () => coupleSetup({ cap, res }) }, '💞 ', t('startCouple')),
          h('button', { class: 'btn ghost', onclick: () => nav.home() }, t('again')),
        ]),
        h('div', { class: 'sci' }, sourcesList()),
      ),
    ),
  );
}

function actions(btns: HTMLElement[]) {
  return h('div', { class: 'actions-bar' }, btns);
}

// ============================================================= two hands

export async function startBoth() {
  const left = await captureHand({ title: t('scanLeft'), subtitle: t('modeBothDesc'), expectedSide: 'left', demoVariant: 1 });
  if (!left) return nav.home();
  const right = await captureHand({ title: t('scanRight'), subtitle: t('modeBothDesc'), expectedSide: 'right', demoVariant: 0 });
  if (!right) return nav.home();
  await analyzing();
  showBoth(left, analyzeHand(left), right, analyzeHand(right));
}

async function continueBoth(cap: HandCapture, res: AnalysisResult) {
  const want = otherSide(cap.side);
  const other = await captureHand({ title: want === 'left' ? t('scanLeft') : t('scanRight'), expectedSide: want, demoVariant: want === 'left' ? 1 : 0 });
  if (!other) return showSingle(cap, res);
  const ores = await runAnalysis(other);
  if (want === 'left') showBoth(other, ores, cap, res);
  else showBoth(cap, res, other, ores);
}

function mirrorCanvas(L: Analysis, R: Analysis) {
  const c = h('canvas', { width: 900, height: 900 }) as HTMLCanvasElement;
  const g = c.getContext('2d')!;
  let t0 = performance.now();
  const frame = () => {
    const p = Math.min(1, (performance.now() - t0) / 1800);
    const ease = 1 - Math.pow(1 - p, 3);
    g.clearRect(0, 0, 900, 900);
    g.fillStyle = '#0e0b1f';
    g.fillRect(0, 0, 900, 900);
    starfield(g, 900, 900, 5, 60);
    // left hand slides from the left, mirrored onto the right hand
    drawStylizedHand(g, L.norm, linesFromAnalysis(L), { cx: 450 - 260 * (1 - ease), cy: 470, size: 300, aspect: L.metrics.palmRatio, mirror: false, fill: 'rgba(169,139,255,0.10)', edge: 'rgba(169,139,255,0.9)', lineColor: '#a98bff', lineWidth: 6 });
    g.globalAlpha = 0.85;
    drawStylizedHand(g, R.norm, linesFromAnalysis(R), { cx: 450 + 260 * (1 - ease), cy: 470, size: 300, aspect: R.metrics.palmRatio, mirror: false, fill: 'rgba(232,195,114,0.06)', edge: 'rgba(232,195,114,0.9)', lineColor: '#e8c372', lineWidth: 6 });
    g.globalAlpha = 1;
    if (p < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  c.addEventListener('click', () => { t0 = performance.now(); requestAnimationFrame(frame); });
  return c;
}

export function showBoth(lc: HandCapture, L: AnalysisResult, rc: HandCapture, R: AnalysisResult) {
  nav.showLayerSwitch(true);
  const cmp = compareHands(L.analysis, R.analysis);
  let dominant: HandSide = 'right';
  const msgBox = h('div', { class: 'duo' });
  const renderMsgs = () => {
    const innate = dominant === 'right' ? L.analysis : R.analysis;
    const present = dominant === 'right' ? R.analysis : L.analysis;
    msgBox.replaceChildren(
      h('div', { class: 'card' }, h('div', { class: 'tag' }, t('innate')), h('p', null, tr(handMessage(innate, 'innate')))),
      h('div', { class: 'card' }, h('div', { class: 'tag' }, t('present')), h('p', null, tr(handMessage(present, 'present')))),
    );
  };
  renderMsgs();
  const domBtns = h('div', { class: 'seg' }, ...(['left', 'right'] as HandSide[]).map((s) => {
    const b = h('button', { 'aria-pressed': String(s === dominant) }, s === 'left' ? t('leftHand') : t('rightHand'));
    b.addEventListener('click', () => { dominant = s; [...domBtns.children].forEach((c) => c.setAttribute('aria-pressed', String(c === b))); renderMsgs(); });
    return b;
  }));
  const sameWarn = lc.detected && rc.detected && lc.detected === rc.detected && lc.source !== 'demo' ? h('div', { class: 'card warn small' }, t('sameSideWarn')) : null;
  mount(
    h('section', { class: 'stack fade-in' },
      h('div', { class: 'headline' }, h('div', { class: 'el' }, t('modeBoth').toUpperCase()), h('h1', null, t('compareTitle'))),
      sameWarn,
      h('div', { class: 'duo' },
        h('div', null, h('h3', { class: 'center' }, t('leftHand')), handViewer(lc, L.analysis, L.patch)),
        h('div', null, h('h3', { class: 'center' }, t('rightHand')), handViewer(rc, R.analysis, R.patch)),
      ),
      h('div', { class: 'duo' },
        h('div', { class: 'card stack center' },
          h('h3', null, t('mirror')),
          h('div', { class: 'viewer' }, mirrorCanvas(L.analysis, R.analysis)),
          h('p', { class: 'tiny' }, getLang() === 'vi' ? 'Tím: tay trái (đã lật gương) · Vàng: tay phải · Chạm để chạy lại' : 'Violet: left hand (mirrored) · Gold: right hand · Tap to replay'),
        ),
        h('div', { class: 'card stack' },
          h('div', { class: 'center' }, h('div', { class: 'muted small' }, t('symmetry')), h('div', { class: 'big-num' }, `${cmp.symmetry}%`)),
          h('table', { class: 'cmp sci' },
            h('thead', null, h('tr', null, h('th', null, ''), h('th', { class: 'mono' }, t('leftHand')), h('th', { class: 'mono' }, t('rightHand')))),
            h('tbody', null, cmp.rows.map((r) => h('tr', null, h('td', null, tr(r.label)), h('td', { class: 'mono' }, r.left), h('td', { class: 'mono' }, r.right)))),
          ),
          h('p', { class: 'sci small' }, getLang() === 'vi'
            ? 'Hai bàn tay không bao giờ đối xứng hoàn hảo. Vân tay hai bên khác nhau và nếp gấp mỗi bên hình thành độc lập trong thai kỳ. Khác biệt 2D:4D giữa hai giới rõ hơn ở tay phải.'
            : 'No two hands are perfectly symmetrical. Fingerprints differ between sides and each palm’s creases form independently before birth. The male–female 2D:4D gap is larger on the right hand.', ' ', srcLinks(['wertheim', 'honekopp10'])),
          h('p', { class: 'mys small' }, getLang() === 'vi'
            ? 'Theo chỉ tay học, tay không thuận cho thấy con người bẩm sinh, tay thuận cho thấy con người bạn đã tạo dựng.'
            : 'Palmists say your non-dominant hand shows who you were born as, and your dominant hand who you have become.'),
        ),
      ),
      h('div', { class: 'card stack' }, h('div', { class: 'row' }, h('b', null, t('dominantQ')), domBtns), msgBox),
      h('div', { class: 'duo' },
        h('div', { class: 'card' }, h('div', { class: 'tag' }, t('leftSays')), h('h3', { style: 'margin-top:8px' }, `${ELEMENTS[L.analysis.element].icon} ${tr(archetypeName(L.analysis))}`), h('p', { class: 'mys' }, tr(ELEMENTS[L.analysis.element].tradition)), h('p', { class: 'sci small' }, `2D:4D ${L.analysis.metrics.digitRatio.toFixed(3)}`)),
        h('div', { class: 'card' }, h('div', { class: 'tag' }, t('rightSays')), h('h3', { style: 'margin-top:8px' }, `${ELEMENTS[R.analysis.element].icon} ${tr(archetypeName(R.analysis))}`), h('p', { class: 'mys' }, tr(ELEMENTS[R.analysis.element].tradition)), h('p', { class: 'sci small' }, `2D:4D ${R.analysis.metrics.digitRatio.toFixed(3)}`)),
      ),
      actions([
        h('button', { class: 'btn primary', onclick: () => openShareModal((f) => bothCard(L.analysis, R.analysis, cmp.symmetry, f), 'palmlens-2-hands.png', `${t('symmetry')} ${cmp.symmetry}%`, siteUrl()) }, '✦ ', t('makeCard')),
        h('button', { class: 'btn', onclick: () => coupleSetup({ cap: dominant === 'right' ? rc : lc, res: dominant === 'right' ? R : L }) }, '💞 ', t('startCouple')),
        h('button', { class: 'btn ghost', onclick: () => nav.home() }, t('again')),
      ]),
      h('div', { class: 'sci' }, sourcesList(['wertheim', 'kimura86', 'honekopp10', 'manning98', 'mediapipe20'])),
    ),
  );
}

// ================================================================ couple

interface Person { name: string; sex?: 'm' | 'f'; profile?: Profile }

function personFields(label: string, p: Person) {
  const name = h('input', { type: 'text', maxlength: '24', placeholder: label, value: p.name }) as HTMLInputElement;
  name.addEventListener('input', () => (p.name = name.value.trim()));
  const sex = h('select', null, h('option', { value: '' }, t('sexNone')), h('option', { value: 'f' }, t('female')), h('option', { value: 'm' }, t('male'))) as HTMLSelectElement;
  sex.addEventListener('change', () => (p.sex = (sex.value || undefined) as Person['sex']));
  return h('div', { class: 'stack' }, h('label', { class: 'field' }, h('span', { class: 'small' }, label), name), h('label', { class: 'field' }, h('span', { class: 'tiny' }, t('sexOpt')), sex));
}

export function coupleSetup(from?: { cap: HandCapture; res: AnalysisResult }) {
  nav.showLayerSwitch(false);
  const A: Person = { name: '' };
  const B: Person = { name: '' };
  const agree = h('input', { type: 'checkbox' }) as HTMLInputElement;
  const go = (remote: boolean) => {
    if (!agree.checked) { toast(t('ageCheck')); agree.focus(); return; }
    if (remote) remoteInvite(A, from);
    else sameDevice(A, B, from);
  };
  mount(
    h('section', { class: 'stack fade-in', style: 'max-width:720px;margin:0 auto' },
      h('div', { class: 'headline' }, h('div', { class: 'el' }, '💞'), h('h1', null, t('coupleTitle')), h('p', { class: 'muted' }, t('coupleIntro'))),
      h('div', { class: 'card' }, h('div', { class: 'duo' }, personFields(t('nameA'), A), personFields(t('nameB'), B)),
        h('label', { class: 'check' }, agree, h('span', null, t('ageCheck')))),
      h('div', { class: 'choice' },
        h('button', { class: 'mode', onclick: () => go(false) }, h('span', { class: 'icon' }, '👫'), h('b', null, t('sameDevice')), h('span', { class: 'small muted' }, t('sameDeviceDesc'))),
        h('button', { class: 'mode', onclick: () => go(true) }, h('span', { class: 'icon' }, '🔗'), h('b', null, t('remote')), h('span', { class: 'small muted' }, t('remoteDesc'))),
      ),
      h('p', { class: 'tiny center' }, getLang() === 'vi' ? 'Mỗi người quét bàn tay thuận của mình.' : 'Each person scans their own dominant hand.'),
    ),
  );
}

async function scanPerson(p: Person, demoVariant: number, existing?: { cap: HandCapture; res: AnalysisResult }): Promise<Profile | null> {
  if (existing) return toProfile(existing.res.analysis, p.name, p.sex);
  const cap = await captureHand({ title: `${t('personTurn')} ${p.name || '…'}`, subtitle: getLang() === 'vi' ? 'Đưa bàn tay thuận lên camera' : 'Show your dominant hand', demoVariant });
  if (!cap) return null;
  const res = await runAnalysis(cap);
  return toProfile(res.analysis, p.name, p.sex);
}

async function sameDevice(A: Person, B: Person, from?: { cap: HandCapture; res: AnalysisResult }) {
  const pa = await scanPerson({ ...A, name: A.name || 'A' }, 0, from);
  if (!pa) return nav.home();
  const pb = await scanPerson({ ...B, name: B.name || 'B' }, 1);
  if (!pb) return nav.home();
  location.hash = coupleHash(pa, pb);
}

async function remoteInvite(A: Person, from?: { cap: HandCapture; res: AnalysisResult }) {
  const pa = await scanPerson({ ...A, name: A.name || 'A' }, 0, from);
  if (!pa) return nav.home();
  const url = inviteUrl(pa);
  const input = h('input', { readonly: true, value: url }) as HTMLInputElement;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast(t('copied')); } catch { input.select(); }
  };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ url, text: `${pa.n} ${t('inviteFrom')}` }); return; } catch { /* cancelled */ } }
    copy();
  };
  mount(h('section', { class: 'stack fade-in center', style: 'max-width:640px;margin:0 auto' },
    h('h1', null, '🔗 ', t('inviteReady')),
    h('p', { class: 'muted' }, t('remoteDesc')),
    h('div', { class: 'linkbox' }, input, h('button', { class: 'btn', onclick: copy }, '⧉')),
    h('div', { class: 'row', style: 'justify-content:center' }, h('button', { class: 'btn primary', onclick: share }, t('share')), h('button', { class: 'btn ghost', onclick: () => nav.home() }, t('again'))),
  ));
}

export function showInvite(pa: Profile) {
  nav.showLayerSwitch(false);
  const B: Person = { name: '' };
  const agree = h('input', { type: 'checkbox' }) as HTMLInputElement;
  mount(h('section', { class: 'stack fade-in', style: 'max-width:640px;margin:0 auto' },
    h('div', { class: 'headline' }, h('div', { class: 'el' }, '💞'), h('h1', null, `${pa.n || 'A'} ${t('inviteFrom')}`), h('p', { class: 'muted' }, t('coupleIntro'))),
    h('div', { class: 'card' }, personFields(t('nameA'), B), h('label', { class: 'check' }, agree, h('span', null, t('ageCheck')))),
    h('div', { class: 'center' }, h('button', { class: 'btn primary', onclick: async () => {
      if (!agree.checked) { toast(t('ageCheck')); return; }
      const pb = await scanPerson({ ...B, name: B.name || 'B' }, 1);
      if (!pb) return showInvite(pa);
      location.hash = coupleHash(pa, pb);
    } }, t('inviteAccept'))),
    h('p', { class: 'center privacy' }, t('privacy')),
  ));
}

function heartLinesCanvas(a: Profile, b: Profile) {
  const c = h('canvas', { width: 900, height: 360 }) as HTMLCanvasElement;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0e0b1f';
  g.fillRect(0, 0, 900, 360);
  starfield(g, 900, 360, 9, 40);
  const draw = (p: Profile, color: string, dy: number, label: string) => {
    const hl = linesFromProfile(p).heart;
    let pts: Pt[];
    if (hl && hl.length > 2) {
      const xs = hl.map((q) => q.x), ys = hl.map((q) => q.y);
      const minx = Math.min(...xs), maxx = Math.max(...xs), my = (Math.min(...ys) + Math.max(...ys)) / 2;
      pts = hl.map((q) => ({ x: 120 + ((q.x - minx) / Math.max(maxx - minx, 0.1)) * 660, y: 180 + dy - (q.y - my) * 420 }));
    } else {
      const bow = (p.h[1] || 0.05) * 660;
      pts = smoothCurve([{ x: 120, y: 180 + dy }, { x: 450, y: 180 + dy - bow }, { x: 780, y: 180 + dy - bow * 0.4 }], 12);
    }
    g.save();
    g.strokeStyle = color; g.shadowColor = color; g.shadowBlur = 18; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.stroke();
    g.restore();
    g.fillStyle = color; g.font = '600 26px system-ui, sans-serif';
    g.fillText(label, 30, pts[0].y + 8);
  };
  draw(a, LINE_COLORS.heart, -50, a.n || 'A');
  draw(b, '#ffb35c', 50, b.n || 'B');
  return c;
}

function interlaceCanvas(a: Profile, b: Profile) {
  const c = h('canvas', { width: 900, height: 700 }) as HTMLCanvasElement;
  const g = c.getContext('2d')!;
  let t0 = performance.now();
  const frame = () => {
    const p = Math.min(1, (performance.now() - t0) / 2200);
    const e = 1 - Math.pow(1 - p, 3);
    g.fillStyle = '#0e0b1f';
    g.fillRect(0, 0, 900, 700);
    starfield(g, 900, 700, 4, 70);
    drawStylizedHand(g, normFromProfile(a), linesFromProfile(a), { cx: 450 - 360 + 190 * e, cy: 400, size: 190, aspect: a.pr, mirror: true, rotate: 0.3 * e, fill: 'rgba(255,92,138,0.10)', edge: 'rgba(255,92,138,0.9)', lineColor: '#ff5c8a', lineWidth: 6 });
    drawStylizedHand(g, normFromProfile(b), linesFromProfile(b), { cx: 450 + 360 - 190 * e, cy: 400, size: 190, aspect: b.pr, mirror: false, rotate: -0.3 * e, fill: 'rgba(255,179,92,0.10)', edge: 'rgba(255,179,92,0.9)', lineColor: '#ffb35c', lineWidth: 6 });
    if (p < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  c.addEventListener('click', () => { t0 = performance.now(); requestAnimationFrame(frame); });
  return c;
}

export function showCouple(a: Profile, b: Profile) {
  nav.showLayerSwitch(true);
  const r = readCouple(a, b);
  const vi = getLang() === 'vi';
  const sexNote = a.g && b.g
    ? h('p', { class: 'sci small' }, vi
        ? `2D:4D: ${a.n} ${a.r.toFixed(3)} · ${b.n} ${b.r.toFixed(3)}. Ở cấp độ quần thể, tỷ lệ này ở nam thường thấp hơn ở nữ một chút, nhưng hai phân bố chồng lấn rất nhiều. Đây không phải thước đo "nam tính" hay "nữ tính" của một người.`
        : `2D:4D: ${a.n} ${a.r.toFixed(3)} · ${b.n} ${b.r.toFixed(3)}. Across populations the ratio is slightly lower in males on average, but the distributions overlap heavily. It is not a measure of anyone’s masculinity or femininity.`, ' ', srcLinks(['honekopp10']))
    : h('p', { class: 'sci small' }, `2D:4D: ${a.n} ${a.r.toFixed(3)} · ${b.n} ${b.r.toFixed(3)}`);
  mount(
    h('section', { class: 'stack fade-in', style: 'max-width:960px;margin:0 auto' },
      h('div', { class: 'couple-hero' },
        h('div', { class: 'names' }, `${a.n || 'A'}  ♥  ${b.n || 'B'}`),
        h('div', { class: 'el tag', style: 'margin-top:8px' }, t('coupleType')),
        h('h1', null, tr(r.type.name)),
        h('p', { class: 'mys' }, tr(r.type.story)),
        h('p', { class: 'tiny mys' }, t('mysticNote')),
      ),
      h('div', { class: 'viewer' }, interlaceCanvas(a, b)),
      h('p', { class: 'tiny center' }, `${t('interlace')} · ${ELEMENTS[a.e].icon} ${tr(ELEMENTS[a.e].name)} + ${ELEMENTS[b.e].icon} ${tr(ELEMENTS[b.e].name)}`),
      h('div', { class: 'duo mys' },
        h('div', { class: 'card' }, h('h3', null, '✦ ', t('alike')), h('ul', { class: 'list-good' }, r.alike.map((x) => h('li', null, tr(x))))),
        h('div', { class: 'card' }, h('h3', null, '✧ ', t('complement')), h('ul', { class: 'list-good' }, r.complement.map((x) => h('li', null, tr(x))))),
      ),
      h('div', { class: 'card stack' }, h('h3', null, t('heartTogether')), h('div', { class: 'viewer' }, heartLinesCanvas(a, b))),
      h('div', { class: 'card stack sci' },
        h('div', { class: 'row', style: 'justify-content:space-between' }, h('h3', { style: 'margin:0' }, t('scienceTag')), h('span', { class: 'tag' }, t('scienceTag'))),
        h('p', null, t('coupleScience')),
        sexNote,
        h('table', { class: 'cmp' },
          h('thead', null, h('tr', null, h('th', null, ''), h('th', { class: 'mono' }, a.n || 'A'), h('th', { class: 'mono' }, b.n || 'B'))),
          h('tbody', null,
            row(t('palmRatio'), a.pr.toFixed(2), b.pr.toFixed(2)),
            row(t('fingerRatio'), a.fr.toFixed(2), b.fr.toFixed(2)),
            row(vi ? 'Tâm đạo (độ dài)' : 'Heart line (length)', a.h[0] ? a.h[0].toFixed(2) : '—', b.h[0] ? b.h[0].toFixed(2) : '—'),
            row(vi ? 'Trí đạo (độ dài)' : 'Head line (length)', a.d[0] ? a.d[0].toFixed(2) : '—', b.d[0] ? b.d[0].toFixed(2) : '—'),
            row(vi ? 'Sinh đạo (độ cong)' : 'Life line (curvature)', a.l[0] ? a.l[1].toFixed(2) : '—', b.l[0] ? b.l[1].toFixed(2) : '—'),
          )),
      ),
      actions([
        h('button', { class: 'btn primary', onclick: () => openShareModal((f) => coupleCard(a, b, r, f), 'palmlens-couple.png', `${a.n} ♥ ${b.n}: ${tr(r.type.name)}`, siteUrl()) }, '✦ ', t('makeCard')),
        h('button', { class: 'btn', onclick: async () => { const url = coupleUrl(a, b); try { await navigator.clipboard.writeText(url); toast(t('copied')); } catch { prompt('', url); } } }, '🔗 ', t('sendBack')),
        h('button', { class: 'btn ghost', onclick: () => nav.home() }, t('again')),
      ]),
    ),
  );
}

function row(k: string, x: string, y: string) {
  return h('tr', null, h('td', null, k), h('td', { class: 'mono' }, x), h('td', { class: 'mono' }, y));
}

