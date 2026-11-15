import { t } from '../i18n';
import type { HandCapture, HandSide, Pt } from '../types';
import { detectInImage, getVideoLandmarker, toHands, type DetectedHand } from '../vision/landmarker';
import { dist } from '../vision/geometry';
import { drawSkeleton } from '../render/draw';
import { makeDemoHand } from '../demo';
import { h, mount, svg, toast } from './dom';

export interface CaptureOptions {
  title: string;
  subtitle?: string;
  /** side the user was asked to show; overrides detection */
  expectedSide?: HandSide;
  demoVariant?: number;
  /** extra content under the actions (e.g. a "skip" link) */
  extra?: Node;
}

const GUIDE_SVG = `<svg viewBox="0 0 200 260" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="7 7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M62 250 L54 170 L22 118 C14 104 30 92 42 104 L64 132 L60 40 C60 26 80 26 82 40 L86 112 L90 22 C90 8 112 8 112 22 L112 110 L118 30 C120 16 140 18 138 32 L134 114 L146 60 C150 46 168 50 164 64 L152 150 C148 196 140 222 134 250 Z"/></svg>`;

function largest(hands: DetectedHand[]): DetectedHand | null {
  let best: DetectedHand | null = null, bw = 0;
  for (const hd of hands) {
    const w = dist(hd.landmarks[5], hd.landmarks[17]);
    if (w > bw) { bw = w; best = hd; }
  }
  return best;
}

function fingersSpread(lm: Pt[]) {
  return [[6, 8], [10, 12], [14, 16], [18, 20]].every(([pip, tip]) => dist(lm[0], lm[tip]) > dist(lm[0], lm[pip]) * 1.12);
}

async function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d', { willReadFrequently: true })!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c;
}

export function captureHand(opts: CaptureOptions): Promise<HandCapture | null> {
  return new Promise((resolve) => {
    let stream: MediaStream | null = null;
    let stopped = false;
    let busy = false;
    const finish = (cap: HandCapture | null) => {
      if (stopped) return;
      stopped = true;
      stream?.getTracks().forEach((tr) => tr.stop());
      if (cap && opts.expectedSide) cap = { ...cap, detected: cap.detected ?? cap.side, side: opts.expectedSide };
      resolve(cap);
    };

    const stage = h('div', { class: 'stage' });
    const placeholder = h('div', { class: 'placeholder' }, h('div', null, h('p', { class: 'muted' }, t('guideShow'))));
    stage.append(placeholder);
    const status = h('div', { class: 'status' }, t('guideShow'));
    const count = h('div', { class: 'count' });
    const fileInput = h('input', { type: 'file', accept: 'image/*', hidden: true }) as HTMLInputElement;
    const camBtn = h('button', { class: 'btn primary', onclick: () => startCamera() }, '📷 ', t('startCamera'));
    const shotBtn = h('button', { class: 'btn primary', hidden: true, onclick: () => snap() }, t('capture'));

    async function useFile(file: File | undefined) {
      if (!file || busy) return;
      busy = true;
      placeholder.replaceChildren(h('div', null, h('div', { class: 'spinner' }), h('p', null, t('loadingModel'))));
      try {
        const canvas = await fileToCanvas(file);
        const hd = largest(await detectInImage(canvas));
        if (!hd) { toast(t('noHand')); placeholder.replaceChildren(h('p', { class: 'muted' }, t('noHand'))); busy = false; return; }
        finish({ image: canvas, landmarks: hd.landmarks, world: hd.world.length === 21 ? hd.world : null, side: hd.side, detected: hd.side, source: 'upload' });
      } catch (e) {
        console.error(e);
        toast(t('modelError'));
        placeholder.replaceChildren(h('p', { class: 'muted' }, t('modelError')));
        busy = false;
      }
    }
    fileInput.addEventListener('change', () => useFile(fileInput.files?.[0]));

    const drop = h('div', { class: 'drop' }, t('upload'), ' · drag & drop');
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); useFile(e.dataTransfer?.files?.[0]); });
    drop.addEventListener('click', () => fileInput.click());

    let lastHand: DetectedHand | null = null;
    let video: HTMLVideoElement | null = null;

    function snap() {
      if (!video || !lastHand) { toast(t('guideShow')); return; }
      const c = document.createElement('canvas');
      c.width = video.videoWidth;
      c.height = video.videoHeight;
      c.getContext('2d', { willReadFrequently: true })!.drawImage(video, 0, 0);
      const hd = lastHand;
      finish({ image: c, landmarks: hd.landmarks, world: hd.world.length === 21 ? hd.world : null, side: hd.side, detected: hd.side, source: 'camera' });
    }

    async function startCamera() {
      if (busy) return;
      busy = true;
      camBtn.setAttribute('disabled', '');
      placeholder.replaceChildren(h('div', null, h('div', { class: 'spinner' }), h('p', null, t('loadingModel'))));
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      } catch {
        placeholder.replaceChildren(h('p', null, t('cameraDenied')));
        camBtn.removeAttribute('disabled');
        busy = false;
        return;
      }
      let lmk;
      try {
        lmk = await getVideoLandmarker();
      } catch (e) {
        console.error(e);
        placeholder.replaceChildren(h('p', null, t('modelError')));
        stream.getTracks().forEach((tr) => tr.stop());
        busy = false;
        return;
      }
      if (stopped) { stream.getTracks().forEach((tr) => tr.stop()); return; }
      video = h('video', { playsinline: true, muted: true, autoplay: true }) as HTMLVideoElement;
      video.muted = true;
      video.srcObject = stream;
      await video.play().catch(() => {});
      const overlay = h('canvas', { class: 'overlay' }) as HTMLCanvasElement;
      const guide = h('div', { class: 'guide' }, svg(GUIDE_SVG));
      placeholder.remove();
      stage.append(video, overlay, guide, status, count);
      camBtn.hidden = true;
      shotBtn.hidden = false;
      busy = false;

      const lum = document.createElement('canvas');
      lum.width = 48; lum.height = 27;
      const lg = lum.getContext('2d', { willReadFrequently: true })!;
      let dark = false, frame = 0, stable = 0, lastT = 0;
      let prev: Pt[] | null = null;

      const tick = () => {
        if (stopped || !video) return;
        const now = performance.now();
        if (video.readyState >= 2 && now - lastT > 55) {
          lastT = now;
          const vw = video.videoWidth, vh = video.videoHeight;
          if (overlay.width !== vw) { overlay.width = vw; overlay.height = vh; }
          const res = lmk.detectForVideo(video, now);
          const hd = largest(toHands(res, vw, vh, false));
          const g = overlay.getContext('2d')!;
          g.clearRect(0, 0, vw, vh);
          if (++frame % 12 === 0) {
            lg.drawImage(video, 0, 0, 48, 27);
            const d = lg.getImageData(0, 0, 48, 27).data;
            let s = 0;
            for (let k = 0; k < d.length; k += 4) s += d[k] + d[k + 1] + d[k + 2];
            dark = s / (d.length / 4) / 765 < 0.18;
          }
          let msg = t('guideShow');
          let cls = '';
          if (hd) {
            lastHand = hd;
            drawSkeleton(g, hd.landmarks, vw / 900);
            const W = dist(hd.landmarks[5], hd.landmarks[17]);
            const move = prev ? hd.landmarks.reduce((a, p, i) => a + dist(p, prev![i]), 0) / 21 / vw : 1;
            prev = hd.landmarks;
            if (W < vh * 0.13) { msg = t('guideCloser'); stable = 0; }
            else if (!fingersSpread(hd.landmarks)) { msg = t('guideSpread'); stable = 0; cls = 'ok'; }
            else if (dark) { msg = t('guideDark'); stable = 0; cls = 'ok'; }
            else {
              cls = 'ready';
              msg = t('guideHold');
              stable = move < 0.006 ? stable + 1 : Math.max(0, stable - 2);
            }
          } else { stable = 0; prev = null; lastHand = null; }
          stage.className = `stage ${cls}`;
          status.textContent = msg;
          const need = 24;
          count.textContent = stable > 6 ? String(Math.max(1, Math.ceil(3 * (1 - stable / need)))) : '';
          if (stable >= need) { snap(); return; }
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    const cancel = h('button', { class: 'btn ghost', onclick: () => finish(null) }, t('cancel'));
    mount(
      h('section', { class: 'capture fade-in' },
        h('h2', null, opts.title),
        opts.subtitle ? h('p', { class: 'center muted' }, opts.subtitle) : null,
        stage,
        h('div', { class: 'row actions' },
          camBtn, shotBtn,
          h('button', { class: 'btn', onclick: () => fileInput.click() }, '🖼️ ', t('upload')),
          h('button', { class: 'btn ghost', onclick: () => finish(makeDemoHand(opts.demoVariant ?? 0)) }, '✋ ', t('demo')),
          cancel,
        ),
        drop,
        fileInput,
        h('p', { class: 'center privacy' }, t('privacy')),
        opts.extra ?? null,
      ),
    );
  });
}
