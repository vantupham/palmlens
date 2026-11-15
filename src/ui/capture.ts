import { t } from '../i18n';
import type { HandCapture, HandSide, Pt } from '../types';
import { detectInImage, getVideoLandmarker, toHands, type DetectedHand } from '../vision/landmarker';
import { liveCreaseScore } from '../vision/palmlines';
import { dist } from '../vision/geometry';
import { drawSkeleton } from '../render/draw';
import { makeDemoHand } from '../demo';
import { track } from '../analytics';
import { h, mount, svg, toast } from './dom';

export interface CaptureOptions {
  title: string;
  subtitle?: string;
  /** side the user was asked to show; overrides detection */
  expectedSide?: HandSide;
  demoVariant?: number;
  /** extra content under the actions */
  extra?: Node;
}

type Facing = 'user' | 'environment';

const GUIDE_SVG = `<svg viewBox="0 0 200 260" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="7 7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M62 250 L54 170 L22 118 C14 104 30 92 42 104 L64 132 L60 40 C60 26 80 26 82 40 L86 112 L90 22 C90 8 112 8 112 22 L112 110 L118 30 C120 16 140 18 138 32 L134 114 L146 60 C150 46 168 50 164 64 L152 150 C148 196 140 222 134 250 Z"/></svg>`;

/** Two small panels: side light (good) vs front light (bad). */
function lightingGuide() {
  const palm = (lines: number) => `
    <path d="M50 108 L46 70 L30 52 C26 46 34 41 40 46 L50 58 L49 22 C49 16 58 16 59 22 L61 52 L63 16 C63 10 72 10 72 16 L73 52 L76 20 C77 14 85 15 84 21 L82 54 L88 34 C90 28 98 30 96 36 L90 72 C88 90 84 100 82 108 Z" fill="#e2a987"/>
    <path d="M50 66 Q66 62 86 60" stroke="#7a3f2c" stroke-width="2" fill="none" opacity="${lines}"/>
    <path d="M48 72 Q64 74 82 80" stroke="#7a3f2c" stroke-width="2" fill="none" opacity="${lines}"/>
    <path d="M48 70 Q58 84 56 104" stroke="#7a3f2c" stroke-width="2" fill="none" opacity="${lines}"/>`;
  const good = svg(`<svg viewBox="0 0 160 120" role="img" aria-label="${t('lightGood')}">
    <rect width="160" height="120" rx="12" fill="#1b1440"/>
    <g transform="translate(118 18) rotate(35)"><path d="M-10 0 h20 l8 14 h-36z" fill="#e8c372"/><circle cx="0" cy="18" r="5" fill="#fff6c8"/></g>
    <path d="M104 34 L84 60 M112 44 L92 70 M96 28 L76 52" stroke="#fff6c8" stroke-width="2" opacity=".6" stroke-dasharray="4 4"/>
    ${palm(0.95)}
    <circle cx="140" cy="100" r="11" fill="#7dffa8"/><path d="M134 100 l4 4 l8 -8" stroke="#0e0b1f" stroke-width="3" fill="none"/>
  </svg>`);
  const bad = svg(`<svg viewBox="0 0 160 120" role="img" aria-label="${t('lightBad')}">
    <rect width="160" height="120" rx="12" fill="#1b1440"/>
    <rect x="6" y="40" width="14" height="40" rx="3" fill="#cfe3ff"/>
    <path d="M22 50 H40 M22 60 H40 M22 70 H40" stroke="#cfe3ff" stroke-width="2" opacity=".6" stroke-dasharray="4 4"/>
    ${palm(0.18)}
    <circle cx="140" cy="100" r="11" fill="#ff7a8a"/><path d="M135 95 l10 10 M145 95 l-10 10" stroke="#0e0b1f" stroke-width="3"/>
  </svg>`);
  return h('div', { class: 'light-guide' },
    h('b', null, t('lightTitle')),
    h('div', { class: 'light-panels' },
      h('figure', null, good, h('figcaption', null, t('lightGood'))),
      h('figure', null, bad, h('figcaption', null, t('lightBad')))),
    h('ul', null, [t('lightTip1'), t('lightTip2'), t('lightTip3'), t('lightTip4')].map((x) => h('li', null, x))),
  );
}

function largest(hands: DetectedHand[]): DetectedHand | null {
  let best: DetectedHand | null = null, bw = 0;
  for (const hd of hands) {
    const w = dist(hd.landmarks[5], hd.landmarks[17]);
    if (w > bw) { bw = w; best = hd; }
  }
  return best;
}

/** Hand is open enough (relaxed and slightly cupped is fine; a fist is not). */
function handOpen(lm: Pt[]) {
  return [[6, 8], [10, 12], [14, 16], [18, 20]].filter(([pip, tip]) => dist(lm[0], lm[tip]) > dist(lm[0], lm[pip]) * 1.04).length >= 3;
}

/**
 * Palm or back of the hand, from MediaPipe's handedness plus the winding of the
 * knuckles in the (unmirrored) image: for a right hand with the palm toward the
 * camera, the index knuckle sits to the image-right of the little-finger knuckle.
 */
export function facingOf(hd: DetectedHand): 'palm' | 'back' | 'unknown' {
  if (hd.score < 0.8) return 'unknown';
  const [w, i, p] = [hd.landmarks[0], hd.landmarks[5], hd.landmarks[17]];
  const cross = (i.x - w.x) * (p.y - w.y) - (i.y - w.y) * (p.x - w.x);
  return (hd.side === 'right') === (cross < 0) ? 'palm' : 'back';
}

async function fileToCanvas(file: Blob, maxSide = 1600): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d', { willReadFrequently: true })!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c;
}

const nextFrame = (v: HTMLVideoElement) =>
  new Promise<void>((res) => {
    const vv = v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
    if (vv.requestVideoFrameCallback) vv.requestVideoFrameCallback(() => res());
    else setTimeout(res, 40);
  });

const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

export function captureHand(opts: CaptureOptions): Promise<HandCapture | null> {
  return new Promise((resolve) => {
    let stream: MediaStream | null = null;
    let stopped = false;
    let busy = false;
    let facing: Facing = 'user';
    let loopId = 0;
    const stopStream = () => { stream?.getTracks().forEach((tr) => tr.stop()); stream = null; };
    const finish = (cap: HandCapture | null) => {
      if (stopped) return;
      stopped = true;
      stopStream();
      if (cap && opts.expectedSide) cap = { ...cap, detected: cap.detected ?? cap.side, side: opts.expectedSide };
      resolve(cap);
    };

    const stage = h('div', { class: 'stage' });
    const placeholder = h('div', { class: 'placeholder guide-intro' }, lightingGuide());
    stage.append(placeholder);
    const status = h('div', { class: 'status' }, t('guideShow'));
    const count = h('div', { class: 'count' });
    const meterFill = h('i', { style: 'width:0%' });
    const meter = h('div', { class: 'clarity', hidden: true }, h('span', null, t('clarity')), h('div', { class: 'meter' }, meterFill));
    const fileInput = h('input', { type: 'file', accept: 'image/*', hidden: true }) as HTMLInputElement;
    const camBtn = h('button', { class: 'btn primary', onclick: () => startCamera() }, '📷 ', t('startCamera'));
    const shotBtn = h('button', { class: 'btn primary', hidden: true, onclick: () => snap() }, t('capture'));
    const flipBtn = h('button', { class: 'btn ghost', hidden: true, onclick: () => { facing = facing === 'user' ? 'environment' : 'user'; startCamera(true); } }, '🔄 ', t('switchCam'));
    const torchBtn = h('button', { class: 'btn ghost', hidden: true }, '🔦 ', t('torch'));
    const manualHint = h('p', { class: 'tiny center', hidden: true }, t('manualHint'));
    let torchOn = false;

    async function useFile(file: File | undefined) {
      if (!file || busy) return;
      busy = true;
      placeholder.replaceChildren(h('div', null, h('div', { class: 'spinner' }), h('p', null, t('loadingModel'))));
      if (!placeholder.isConnected) stage.replaceChildren(placeholder);
      stopStream();
      try {
        const canvas = await fileToCanvas(file);
        const hd = largest(await detectInImage(canvas));
        if (!hd) { toast(t('noHand')); placeholder.replaceChildren(h('p', { class: 'muted' }, t('noHand'))); busy = false; return; }
        finish({ image: canvas, landmarks: hd.landmarks, world: hd.world.length === 21 ? hd.world : null, side: hd.side, detected: hd.side, source: 'upload', facing: facingOf(hd) });
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
    let lmk: Awaited<ReturnType<typeof getVideoLandmarker>> | null = null;
    let snapping = false;

    /** Burst of ~8 frames (noise averaging) + a full-resolution still where supported. */
    async function snap() {
      if (snapping) return;
      if (!video || !lastHand || !lmk) { toast(t('guideShow')); return; }
      snapping = true;
      loopId++; // stop the preview loop while we shoot
      status.textContent = t('bursting');
      const v = video;
      const frames: { image: HTMLCanvasElement; hd: DetectedHand }[] = [];
      for (let i = 0; i < 10 && frames.length < 8; i++) {
        await nextFrame(v);
        const c = document.createElement('canvas');
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        c.getContext('2d', { willReadFrequently: true })!.drawImage(v, 0, 0);
        const hd = largest(toHands(lmk.detectForVideo(c, performance.now()), c.width, c.height, false));
        if (hd) frames.push({ image: c, hd });
      }
      if (!frames.length) { snapping = false; toast(t('guideShow')); loop(); return; }
      const main = frames[Math.floor(frames.length / 2)];
      let image = main.image, hdMain = main.hd;
      // A real photo from the camera sensor (higher resolution) when the browser allows it.
      const track0 = stream?.getVideoTracks()[0];
      const IC = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto: () => Promise<Blob> } }).ImageCapture;
      if (IC && track0 && facing === 'environment') {
        try {
          const blob = await withTimeout(new IC(track0).takePhoto(), 3000);
          const still = await fileToCanvas(blob, 2400);
          const hd = largest(await detectInImage(still));
          if (hd && still.width > image.width) { image = still; hdMain = hd; }
        } catch { /* keep the video frame */ }
      }
      const extras = frames.filter((f) => f.image !== image).map((f) => ({ image: f.image, landmarks: f.hd.landmarks }));
      track('capture', `${facing}-${extras.length + 1}f`);
      finish({ image, landmarks: hdMain.landmarks, world: hdMain.world.length === 21 ? hdMain.world : null, side: hdMain.side, detected: hdMain.side, source: 'camera', extras, facing: facingOf(hdMain), mirrored: facing === 'user' && image === main.image });
    }

    async function startCamera(restart = false) {
      if (busy) return;
      busy = true;
      camBtn.setAttribute('disabled', '');
      loopId++;
      stopStream();
      if (!restart || !placeholder.isConnected) stage.replaceChildren(placeholder);
      placeholder.replaceChildren(h('div', null, h('div', { class: 'spinner' }), h('p', null, t('loadingModel'))));
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
      } catch {
        placeholder.replaceChildren(h('p', null, t('cameraDenied')));
        camBtn.removeAttribute('disabled');
        busy = false;
        return;
      }
      try {
        lmk = await getVideoLandmarker();
      } catch (e) {
        console.error(e);
        placeholder.replaceChildren(h('p', null, t('modelError')));
        stopStream();
        busy = false;
        return;
      }
      if (stopped) { stopStream(); return; }
      const track = stream.getVideoTracks()[0];
      try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }); } catch { /* unsupported */ }
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
      torchBtn.hidden = !caps.torch;
      torchOn = false;
      torchBtn.onclick = async () => {
        torchOn = !torchOn;
        try { await track.applyConstraints({ advanced: [{ torch: torchOn } as MediaTrackConstraintSet] }); torchBtn.classList.toggle('primary', torchOn); } catch { torchBtn.hidden = true; }
      };
      const cams = (await navigator.mediaDevices.enumerateDevices().catch(() => [])).filter((d) => d.kind === 'videoinput');
      flipBtn.hidden = cams.length < 2;

      video = h('video', { playsinline: true, autoplay: true }) as HTMLVideoElement;
      video.muted = true;
      video.srcObject = stream;
      await video.play().catch(() => {});
      const overlay = h('canvas', { class: 'overlay' }) as HTMLCanvasElement;
      const guide = h('div', { class: 'guide' }, svg(GUIDE_SVG));
      stage.replaceChildren(video, overlay, guide, status, count, meter);
      stage.classList.toggle('mirror', facing === 'user');
      meter.hidden = false;
      camBtn.hidden = true;
      shotBtn.hidden = false;
      busy = false;
      overlayCanvas = overlay;
      loop();
    }

    let overlayCanvas: HTMLCanvasElement | null = null;
    const small = document.createElement('canvas');
    const sg = small.getContext('2d', { willReadFrequently: true })!;

    function loop() {
      const id = ++loopId;
      const v = video!, overlay = overlayCanvas!;
      let stable = 0, lastT = 0, lastLive = 0, clarity = -1, backFrames = 0, tipIdx = 0, holdSince = 0;
      let prev: Pt[] | null = null;
      let issue: 'dark' | 'bright' | 'blurry' | 'small' | null = null;
      const tick = () => {
        if (stopped || id !== loopId) return;
        const now = performance.now();
        if (v.readyState >= 2 && now - lastT > 55) {
          lastT = now;
          const vw = v.videoWidth, vh = v.videoHeight;
          if (overlay.width !== vw) { overlay.width = vw; overlay.height = vh; }
          const hd = largest(toHands(lmk!.detectForVideo(v, now), vw, vh, false));
          const g = overlay.getContext('2d')!;
          g.clearRect(0, 0, vw, vh);
          let msg = t('guideShow');
          let cls = '';
          let ready = false;
          if (hd) {
            lastHand = hd;
            drawSkeleton(g, hd.landmarks, vw / 900);
            const W = dist(hd.landmarks[5], hd.landmarks[17]);
            const move = prev ? hd.landmarks.reduce((a, p, i) => a + dist(p, prev![i]), 0) / 21 / vw : 1;
            prev = hd.landmarks;
            backFrames = facingOf(hd) === 'back' ? backFrames + 1 : Math.max(0, backFrames - 1);
            // live crease visibility on a downscaled frame, ~2× per second
            if (now - lastLive > 450 && W >= vh * 0.13 && move < 0.02) {
              lastLive = now;
              const k = Math.min(1, 960 / vw);
              small.width = Math.round(vw * k);
              small.height = Math.round(vh * k);
              sg.drawImage(v, 0, 0, small.width, small.height);
              const live = liveCreaseScore(small, hd.landmarks.map((p) => ({ x: p.x * k, y: p.y * k })));
              clarity = clarity < 0 ? live.score : clarity * 0.5 + live.score * 0.5;
              issue = live.quality.issues[0] ?? null;
              meterFill.style.width = `${Math.round(clarity * 100)}%`;
              meter.classList.toggle('good', clarity >= 0.4);
              tipIdx++;
            }
            if (W < vh * 0.13) { msg = t('guideCloser'); stable = 0; }
            else if (backFrames > 6) { msg = t('guideBack'); stable = 0; cls = 'ok'; }
            else if (!handOpen(hd.landmarks)) { msg = t('guideSpread'); stable = 0; cls = 'ok'; }
            else if (issue === 'dark') { msg = t('guideDark'); cls = 'ok'; stable = move < 0.006 ? stable + 1 : 0; }
            else if (issue === 'bright') { msg = t('guideBright'); cls = 'ok'; stable = move < 0.006 ? stable + 1 : 0; }
            else {
              stable = move < 0.006 ? stable + 1 : Math.max(0, stable - 2);
              if (move >= 0.006) msg = t('tipFocus');
              else if (clarity >= 0 && clarity < 0.4) msg = [t('tipAngle'), t('tipCup')][Math.floor(tipIdx / 4) % 2];
              else msg = t('guideHold');
              cls = clarity >= 0.4 ? 'ready' : 'ok';
              ready = clarity >= 0.4;
            }
            if (stable > 0 && !holdSince) holdSince = now;
            if (stable === 0) holdSince = 0;
          } else { stable = 0; prev = null; lastHand = null; holdSince = 0; }
          stage.className = `stage ${cls}${facing === 'user' ? ' mirror' : ''}`;
          status.textContent = msg;
          manualHint.hidden = !(holdSince && now - holdSince > 6000 && !ready);
          shotBtn.classList.toggle('pulse', !manualHint.hidden);
          const need = 22;
          count.textContent = ready && stable > 6 ? String(Math.max(1, Math.ceil(3 * (1 - stable / need)))) : '';
          if (ready && stable >= need) { snap(); return; }
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
        manualHint,
        h('div', { class: 'row actions' },
          camBtn, shotBtn, flipBtn, torchBtn,
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
