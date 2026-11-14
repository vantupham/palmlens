import './styles.css';
import { getLang, setLang, t } from './i18n';
import { decodeProfile } from './share/codec';
import { makeDemoHand } from './demo';
import { palmFrame } from './vision/geometry';
import { drawStylizedHand, starfield } from './render/draw';
import { h, mount } from './ui/dom';
import { coupleSetup, nav, showCouple, showInvite, startBoth, startSingle } from './ui/views';

const REPO = 'https://github.com/vantupham/palmlens';

// ------------------------------------------------------------ chrome

function setLayer(l: 'science' | 'mystic') {
  document.body.dataset.layer = l;
}

function renderChrome() {
  document.documentElement.lang = getLang();
  const sw = document.getElementById('layerSwitch')!;
  const [sci, mys] = sw.querySelectorAll('button');
  sci.textContent = '🔬 ' + t('science');
  mys.textContent = '🔮 ' + t('mystic');
  sci.onclick = () => setLayer('science');
  mys.onclick = () => setLayer('mystic');
  const lang = document.getElementById('langBtn')!;
  lang.textContent = t('langSwitch');
  lang.title = getLang() === 'vi' ? 'Switch to English' : 'Chuyển sang tiếng Việt';
  lang.onclick = () => { setLang(getLang() === 'vi' ? 'en' : 'vi'); renderChrome(); route(); };
  document.getElementById('foot')!.replaceChildren(
    h('div', null, t('footer')),
    h('div', { style: 'margin-top:6px' }, h('a', { href: REPO, target: '_blank', rel: 'noopener' }, t('github')), ' · ', h('a', { href: `${REPO}/blob/main/METHODOLOGY.md`, target: '_blank', rel: 'noopener' }, t('methodology'))),
  );
}

nav.showLayerSwitch = (on: boolean) => {
  document.getElementById('layerSwitch')!.hidden = !on;
  if (!on) setLayer('mystic');
};

// --------------------------------------------------------------- home

function heroArt() {
  const c = h('canvas', { width: 920, height: 920, 'aria-hidden': 'true' }) as HTMLCanvasElement;
  const g = c.getContext('2d')!;
  const demo = makeDemoHand(0);
  const f = palmFrame(demo.landmarks);
  const norm = demo.landmarks.map((p) => f.toUV(p));
  const lines = {
    heart: [{ x: -0.75, y: 0.68 }, { x: -0.4, y: 0.74 }, { x: 0, y: 0.8 }, { x: 0.22, y: 0.92 }],
    head: [{ x: 0.5, y: 0.72 }, { x: 0.1, y: 0.62 }, { x: -0.3, y: 0.5 }, { x: -0.55, y: 0.4 }],
    life: [{ x: 0.45, y: 0.7 }, { x: 0.2, y: 0.55 }, { x: 0.12, y: 0.3 }, { x: 0.15, y: 0.05 }],
  };
  const t0 = performance.now();
  let alive = true;
  const frame = () => {
    if (!alive || !c.isConnected) { alive = false; return; }
    const tt = (performance.now() - t0) / 1000;
    g.clearRect(0, 0, 920, 920);
    starfield(g, 920, 920, 21, 70);
    const glow = g.createRadialGradient(460, 470, 30, 460, 470, 420);
    glow.addColorStop(0, 'rgba(169,139,255,0.25)');
    glow.addColorStop(1, 'rgba(169,139,255,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, 920, 920);
    const prog = Math.min(1, (tt % 6) / 3);
    drawStylizedHand(g, norm, lines, { cx: 460, cy: 470 + Math.sin(tt * 1.2) * 8, size: 300, aspect: f.L / f.W, progress: prog });
    // scan beam
    const y = 120 + ((tt * 180) % 700);
    const beam = g.createLinearGradient(0, y - 40, 0, y + 4);
    beam.addColorStop(0, 'rgba(125,255,168,0)');
    beam.addColorStop(1, 'rgba(125,255,168,0.35)');
    g.fillStyle = beam;
    g.fillRect(120, y - 40, 680, 44);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return c;
}

function home() {
  nav.showLayerSwitch(false);
  if (location.hash && location.hash !== '#/') history.replaceState(null, '', location.pathname + location.search);
  const vi = getLang() === 'vi';
  mount(
    h('section', { class: 'hero fade-in' },
      h('div', null,
        h('span', { class: 'tag' }, 'AI · ' + (vi ? 'KHOA HỌC' : 'SCIENCE') + ' · ' + (vi ? 'TRUYỀN THỐNG' : 'TRADITION')),
        h('h1', { html: vi ? 'Bàn tay bạn <em>nói gì</em>?' : 'What does your <em>hand</em> say?' }),
        h('p', { class: 'lead' }, t('heroLead')),
        h('div', { class: 'modes' },
          mode('✋', t('modeSingle'), t('modeSingleDesc'), startSingle),
          mode('🤲', t('modeBoth'), t('modeBothDesc'), startBoth),
          mode('💞', t('modeCouple'), t('modeCoupleDesc'), () => coupleSetup()),
        ),
        h('div', { class: 'privacy' }, t('privacy')),
      ),
      h('div', { class: 'hero-art' }, heroArt()),
    ),
    h('section', { class: 'how' },
      how('1', vi ? 'AI thấy bàn tay' : 'The AI sees your hand', vi ? 'MediaPipe dò 21 điểm khớp theo thời gian thực, ngay trong trình duyệt.' : 'MediaPipe tracks 21 joints in real time, right in your browser.'),
      how('2', vi ? 'Tìm và đo đường chỉ' : 'Lines found and measured', vi ? 'Lòng bàn tay được nắn phẳng, bộ lọc Hessian tìm các rãnh tối mảnh, rồi đo độ dài, độ cong, độ rõ.' : 'The palm is flattened and a Hessian filter finds thin dark grooves, then measures length, curve and clarity.'),
      how('3', vi ? 'Hai cách đọc' : 'Two readings', vi ? 'Gạt sang Khoa học để xem bằng chứng và nguồn trích dẫn; gạt sang Truyền thống để nghe người xưa nói.' : 'Switch to Science for evidence and citations, or to Tradition to hear what palmists say.'),
    ),
  );
}

function mode(icon: string, title: string, desc: string, run: () => void) {
  return h('button', { class: 'mode', onclick: run }, h('span', { class: 'icon' }, icon), h('b', null, title), h('span', { class: 'small muted' }, desc));
}
function how(n: string, title: string, body: string) {
  return h('div', { class: 'card' }, h('div', { class: 'tag' }, n), h('h3', { style: 'margin-top:8px' }, title), h('p', { class: 'small muted', style: 'margin:0' }, body));
}

nav.home = () => {
  if (location.hash && location.hash !== '#/') location.hash = '#/';
  else home();
};

// -------------------------------------------------------------- router

function route() {
  const hash = location.hash.replace(/^#/, '');
  const [path, qs] = hash.split('?');
  const q = new URLSearchParams(qs ?? '');
  if (path === '/invite') {
    const p = decodeProfile(q.get('p') ?? '');
    if (p) return showInvite(p);
  }
  if (path === '/couple') {
    const a = decodeProfile(q.get('a') ?? '');
    const b = decodeProfile(q.get('b') ?? '');
    if (a && b) return showCouple(a, b);
  }
  if (path === '/single') return startSingle();
  if (path === '/both') return startBoth();
  if (path === '/pair') return coupleSetup();
  home();
}

window.addEventListener('hashchange', route);
renderChrome();
route();
