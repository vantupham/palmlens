/**
 * A drawn sample hand so people without a camera (and automated tests) can try
 * the full pipeline. Landmarks are known exactly; creases are drawn where
 * anatomy places them.
 */
import type { HandCapture, Pt } from './types';

const LM: [number, number][] = [
  [470, 1080], [360, 990], [270, 880], [215, 780], [180, 690],
  [350, 640], [325, 470], [312, 370], [302, 290],
  [465, 620], [462, 430], [460, 320], [458, 230],
  [570, 640], [588, 465], [598, 365], [606, 290],
  [660, 690], [695, 565], [712, 490], [726, 425],
];

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function makeDemoHand(variant = 0): HandCapture {
  const W = 900, H = 1200;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#2b2f3a');
  bg.addColorStop(1, '#14161c');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  const lm: Pt[] = LM.map(([x, y]) => ({ x, y }));
  if (variant === 1) {
    // second sample: mirrored (a left hand), slightly longer palm
    for (const p of lm) { p.x = W - p.x; p.y = 1080 + (p.y - 1080) * 1.04; }
  }
  const m = variant === 1 ? (x: number) => W - x : (x: number) => x;
  const skin = g.createRadialGradient(m(470), 820, 60, m(470), 820, 520);
  skin.addColorStop(0, '#f1c4a3');
  skin.addColorStop(0.7, '#e2a987');
  skin.addColorStop(1, '#c98c6d');
  g.fillStyle = skin;
  g.strokeStyle = skin;
  g.lineCap = 'round';
  g.lineJoin = 'round';

  // palm
  g.beginPath();
  const palm: [number, number][] = [[400, 1180], [330, 1040], [250, 900], [300, 700], [330, 610], [460, 590], [580, 610], [690, 650], [745, 760], [735, 950], [660, 1180]];
  palm.forEach(([x, y], i) => (i ? g.lineTo(m(x), y) : g.moveTo(m(x), y)));
  g.closePath();
  g.fill();
  // fingers as capsules
  const widths = [100, 92, 98, 90, 76];
  const chains = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
  chains.forEach((ch, f) => {
    g.lineWidth = widths[f];
    g.beginPath();
    ch.forEach((k, i) => (i ? g.lineTo(lm[k].x, lm[k].y) : g.moveTo(lm[k].x, lm[k].y)));
    g.stroke();
  });

  // creases
  const crease = (pts: number[], width: number, alpha: number) => {
    g.save();
    g.filter = 'blur(1.4px)';
    g.strokeStyle = `rgba(110, 60, 45, ${alpha})`;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(m(pts[0]), pts[1]);
    g.bezierCurveTo(m(pts[2]), pts[3], m(pts[4]), pts[5], m(pts[6]), pts[7]);
    g.stroke();
    g.restore();
  };
  const y = (v: number) => (variant === 1 ? 1080 + (v - 1080) * 1.04 : v);
  crease([738, y(775), 640, y(748), 520, y(738), 410, y(662)], 5, 0.6); // heart
  crease([305, y(738), 400, y(765), 520, y(805), 640, y(895)], 5, 0.55); // head
  crease([308, y(748), 425, y(820), 440, y(960), 425, y(1115)], 6, 0.6); // life
  crease([505, y(1100), 498, y(960), 492, y(860), 488, y(760)], 3.5, variant === 1 ? 0.15 : 0.35); // fate
  // finger joint creases
  for (const k of [6, 7, 10, 11, 14, 15, 18, 19, 3]) {
    const p = lm[k];
    g.save();
    g.filter = 'blur(1px)';
    g.strokeStyle = 'rgba(120, 70, 55, 0.35)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(p.x - 30, p.y + 4);
    g.quadraticCurveTo(p.x, p.y - 4, p.x + 30, p.y + 4);
    g.stroke();
    g.restore();
  }

  // skin texture
  const img = g.getImageData(0, 0, W, H);
  const r = rng(7 + variant);
  for (let k = 0; k < img.data.length; k += 4) {
    if (img.data[k] < 120) continue;
    const n = (r() - 0.5) * 14;
    img.data[k] += n;
    img.data[k + 1] += n;
    img.data[k + 2] += n;
  }
  g.putImageData(img, 0, 0);

  return { image: c, landmarks: lm, world: null, side: variant === 1 ? 'left' : 'right', source: 'demo' };
}
