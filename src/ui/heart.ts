import { getLang, t } from '../i18n';
import type { Pt } from '../types';
import { getVideoLandmarker, toHands } from '../vision/landmarker';
import { detectHeart, heartPath, samePersonScore, type HeartPose } from '../vision/heart';
import { countFaces, getFaceDetector } from '../vision/faces';
import { drawSkeleton } from '../render/draw';
import { shareCanvas } from '../share/card';
import { siteUrl } from '../share/codec';
import { track } from '../analytics';
import { h, mount, toast } from './dom';
import { nav } from './views';

const PINK = '#ff5c8a';

function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function drawHeart(g: CanvasRenderingContext2D, pose: Pick<HeartPose, 'top' | 'bottom' | 'width'>, alpha: number, lw: number) {
  const pts = heartPath(pose.top, pose.bottom, pose.width);
  g.save();
  g.globalAlpha = alpha;
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.closePath();
  g.fillStyle = 'rgba(255,92,138,0.22)';
  g.fill();
  g.strokeStyle = PINK;
  g.shadowColor = PINK;
  g.shadowBlur = lw * 5;
  g.lineWidth = lw * 2.2;
  g.globalAlpha = alpha * 0.5;
  g.stroke();
  g.globalAlpha = alpha;
  g.lineWidth = lw;
  g.stroke();
  g.restore();
}

/** The keepsake photo: mirrored like the preview, heart glow, sparkles, names. */
export function composeHeartPhoto(frame: CanvasImageSource & { width: number; height: number }, a: Pt[], b: Pt[], pose: HeartPose, names: [string, string], solo = false): HTMLCanvasElement {
  const W = frame.width, H = frame.height;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.save();
  g.translate(W, 0);
  g.scale(-1, 1);
  g.drawImage(frame, 0, 0, W, H);
  // soft vignette
  g.restore();
  const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(14,11,31,0)');
  vg.addColorStop(1, 'rgba(14,11,31,0.75)');
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);
  const mirror = (p: Pt): Pt => ({ x: W - p.x, y: p.y });
  const mp = { top: mirror(pose.top), bottom: mirror(pose.bottom), width: pose.width };
  const lw = Math.max(3, W / 260);
  drawSkeleton(g, a.map(mirror), W / 1100, 'rgba(255,200,220,0.55)');
  drawSkeleton(g, b.map(mirror), W / 1100, 'rgba(255,200,220,0.55)');
  drawHeart(g, mp, 1, lw);
  // sparkles around the heart
  const r = rng(Math.round(pose.width));
  for (let i = 0; i < 46; i++) {
    const ang = r() * Math.PI * 2, rad = pose.width * (0.45 + r() * 0.5);
    const cx = mp.top.x + Math.cos(ang) * rad, cy = (mp.top.y + mp.bottom.y) / 2 + Math.sin(ang) * rad * 0.8;
    const s = lw * (0.6 + r() * 1.8);
    g.save();
    g.fillStyle = r() > 0.5 ? '#ffd25c' : '#ffffff';
    g.shadowColor = g.fillStyle;
    g.shadowBlur = s * 4;
    g.globalAlpha = 0.5 + r() * 0.5;
    g.beginPath();
    g.moveTo(cx, cy - s * 2); g.lineTo(cx + s * 0.5, cy - s * 0.5); g.lineTo(cx + s * 2, cy); g.lineTo(cx + s * 0.5, cy + s * 0.5);
    g.lineTo(cx, cy + s * 2); g.lineTo(cx - s * 0.5, cy + s * 0.5); g.lineTo(cx - s * 2, cy); g.lineTo(cx - s * 0.5, cy - s * 0.5);
    g.closePath();
    g.fill();
    g.restore();
  }
  // caption band
  const band = Math.round(H * 0.14);
  const grad = g.createLinearGradient(0, H - band * 1.6, 0, H);
  grad.addColorStop(0, 'rgba(14,11,31,0)');
  grad.addColorStop(1, 'rgba(14,11,31,0.92)');
  g.fillStyle = grad;
  g.fillRect(0, H - band * 1.6, W, band * 1.6);
  g.textAlign = 'center';
  g.fillStyle = '#fff';
  g.font = `700 ${Math.round(band * 0.36)}px Georgia, serif`;
  const who = solo
    ? (getLang() === 'vi' ? 'Đang chờ một nửa còn lại ♥' : 'Waiting for my other half ♥')
    : names.filter(Boolean).join('  ♥  ') || '♥';
  g.fillText(who, W / 2, H - band * 0.62);
  g.fillStyle = '#e8c372';
  g.font = `600 ${Math.round(band * 0.17)}px ui-sans-serif, system-ui, sans-serif`;
  g.fillText(`PALMLENS AI · vantupham.github.io/palmlens`, W / 2, H - band * 0.22);
  return c;
}

export function heartGame(names: [string, string] = ['', '']) {
  nav.showLayerSwitch(false);
  track('heart_start');
  const vi = getLang() === 'vi';
  let stream: MediaStream | null = null;
  let stopped = false;
  const stop = () => { stopped = true; stream?.getTracks().forEach((tr) => tr.stop()); };
  const stage = h('div', { class: 'stage' });
  const placeholder = h('div', { class: 'placeholder' }, h('div', null,
    h('div', { style: 'font-size:64px' }, '🫶'),
    h('p', null, vi ? 'Mỗi người đưa MỘT bàn tay, cong như chữ C. Đầu ngón tay chạm nhau ở trên, hai ngón cái chạm nhau ở dưới.' : 'Each person shows ONE hand curved like a C. Fingertips touch at the top, thumbs touch at the bottom.'),
    h('p', { class: 'tiny' }, vi ? 'Chỉ có một mình? Vẫn chơi được, AI sẽ nhận ra và chờ người ấy vài giây.' : 'On your own? You can still play; the AI notices and waits a few seconds for your partner.')));
  stage.append(placeholder);
  const status = h('div', { class: 'status' }, vi ? 'Ghép một trái tim nào!' : 'Make a heart!');
  const ring = h('div', { class: 'count' });
  const startBtn = h('button', { class: 'btn primary' }, '📷 ', t('startCamera'));

  startBtn.addEventListener('click', async () => {
    startBtn.setAttribute('disabled', '');
    placeholder.replaceChildren(h('div', null, h('div', { class: 'spinner' }), h('p', null, t('loadingModel'))));
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    } catch {
      placeholder.replaceChildren(h('p', null, t('cameraDenied')));
      startBtn.removeAttribute('disabled');
      return;
    }
    let lmk;
    try { lmk = await getVideoLandmarker(); } catch { placeholder.replaceChildren(h('p', null, t('modelError'))); stop(); return; }
    if (stopped) return stop();
    const video = h('video', { playsinline: true, autoplay: true }) as HTMLVideoElement;
    video.muted = true;
    video.srcObject = stream;
    await video.play().catch(() => {});
    const overlay = h('canvas', { class: 'overlay' }) as HTMLCanvasElement;
    placeholder.remove();
    stage.append(video, overlay, status, ring);
    startBtn.hidden = true;
    let held = 0, lastT = 0, lastFace = 0, faces = -1, soloEma = 0, soloSince = 0;
    let faceDet: Awaited<ReturnType<typeof getFaceDetector>> = null;
    getFaceDetector().then((d) => (faceDet = d));
    const WAIT_MS = 4500; // how long to wait for a partner before snapping a solo heart
    const tick = () => {
      if (stopped) return;
      const now = performance.now();
      if (video.readyState >= 2 && now - lastT > 50) {
        lastT = now;
        const vw = video.videoWidth, vh = video.videoHeight;
        if (overlay.width !== vw) { overlay.width = vw; overlay.height = vh; }
        const g = overlay.getContext('2d')!;
        g.clearRect(0, 0, vw, vh);
        const hands = toHands(lmk.detectForVideo(video, now), vw, vh, false);
        if (faceDet && now - lastFace > 500) { lastFace = now; faces = countFaces(faceDet, video, now); }
        hands.forEach((hd) => drawSkeleton(g, hd.landmarks, vw / 1000, 'rgba(255,200,220,0.85)'));
        if (hands.length < 2) {
          held = 0;
          status.textContent = vi ? (hands.length ? 'Cần thêm một bàn tay nữa' : 'Hai người, mỗi người một tay') : hands.length ? 'One more hand needed' : 'Two people, one hand each';
        } else {
          const [a, b] = hands;
          const pose = detectHeart(a.landmarks, b.landmarks);
          // one person or two? faces are strong evidence; hand geometry decides otherwise
          let same = samePersonScore(a.landmarks, b.landmarks);
          if (faces >= 2) same = -1;
          else if (faces === 1) same += 0.6;
          if (pose.ok) {
            soloEma = soloEma * 0.7 + (same > 0.3 ? 0.3 : 0);
            const solo = soloEma > 0.6;
            if (solo && !soloSince) soloSince = now;
            if (!solo) soloSince = 0;
            held++;
            drawHeart(g, pose, Math.min(1, held / 8), Math.max(3, vw / 260));
            const waitLeft = solo ? Math.max(0, WAIT_MS - (now - soloSince)) : 0;
            status.textContent = solo
              ? waitLeft > 0
                ? (vi ? `Bạn đang tự thả tim cho chính mình 😄 Rủ người ấy vào khung nhé! (${Math.ceil(waitLeft / 1000)})` : `You're sending a heart to yourself 😄 Get your partner in the frame! (${Math.ceil(waitLeft / 1000)})`)
                : (vi ? 'Thôi được, chụp trái tim tự thả nhé… ♥' : 'Okay, a solo heart it is… ♥')
              : (vi ? 'Giữ yên… ♥' : 'Hold it… ♥');
            if (waitLeft > 0) held = Math.min(held, 10); // hold off the snap while waiting for a partner
          } else {
            held = Math.max(0, held - 2);
            status.textContent = pose.score > 0.5 ? (vi ? 'Gần được rồi! Chạm đầu ngón và ngón cái' : 'Almost! Touch fingertips and thumbs') : (vi ? 'Ghép một trái tim nào!' : 'Make a heart!');
          }
          ring.textContent = held > 3 ? '♥' : '';
          ring.style.color = PINK;
          ring.style.opacity = String(Math.min(1, held / 14));
          if (held >= 14) {
            const frame = document.createElement('canvas');
            frame.width = vw; frame.height = vh;
            frame.getContext('2d')!.drawImage(video, 0, 0);
            stop();
            const solo = soloEma > 0.6;
            track('heart_captured', solo ? 'solo' : 'duo');
            showHeartResult(composeHeartPhoto(frame, a.landmarks, b.landmarks, pose, names, solo), names, solo);
            return;
          }
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  mount(h('section', { class: 'capture fade-in' },
    h('h2', null, '🫶 ', vi ? 'Trái tim hai bàn tay' : 'Two-hand heart'),
    h('p', { class: 'center muted' }, vi ? 'Thử thách cho cặp đôi: hai người cùng ghép một trái tim trước camera. AI nhận ra là tự chụp.' : 'A couples challenge: make one heart together in front of the camera. The AI snaps it automatically.'),
    stage,
    h('div', { class: 'row actions' }, startBtn, h('button', { class: 'btn ghost', onclick: () => { stop(); nav.home(); } }, t('cancel'))),
    h('p', { class: 'center privacy' }, vi ? 'Ảnh chụp chỉ nằm trên máy bạn cho tới khi bạn tự chia sẻ' : 'The photo stays on your device unless you share it'),
  ));
}

function showHeartResult(photo: HTMLCanvasElement, names: [string, string], solo = false) {
  const vi = getLang() === 'vi';
  const img = h('img', { src: photo.toDataURL('image/jpeg', 0.92), alt: vi ? 'Ảnh trái tim hai bàn tay' : 'Two-hand heart photo', style: 'width:100%;display:block' });
  mount(h('section', { class: 'stack fade-in', style: 'max-width:820px;margin:0 auto' },
    h('div', { class: 'headline' }, h('div', { class: 'el' }, '🫶'),
      h('h1', null, solo ? (vi ? 'Một trái tim tự thả' : 'A solo heart') : vi ? 'Một trái tim, hai bàn tay' : 'One heart, two hands'),
      solo ? h('p', { class: 'muted' }, vi ? 'Có vẻ cả hai bàn tay đều là của bạn. Rủ người ấy chụp lại cùng nhau nhé!' : 'Looks like both hands were yours. Try again together with your partner!') : null),
    h('div', { class: 'viewer' }, img),
    h('div', { class: 'actions-bar' },
      h('button', { class: 'btn primary', onclick: async () => {
        const r = await shareCanvas(photo, 'palmlens-heart.png', names.filter(Boolean).join(' ♥ ') || '♥', siteUrl());
        track('card_share', `heart-${r}`);
        if (r === 'downloaded') toast(t('download') + ' ✓');
      } }, t('share')),
      h('button', { class: solo ? 'btn primary' : 'btn', onclick: () => heartGame(names) }, solo ? (vi ? 'Chụp lại cùng người ấy' : 'Retake together') : vi ? 'Chụp lại' : 'Try again'),
      h('button', { class: 'btn ghost', onclick: () => nav.home() }, t('again')),
    ),
  ));
}
