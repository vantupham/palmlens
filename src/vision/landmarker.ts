import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision';
import type { HandSide, Pt } from '../types';

const BASE = import.meta.env.BASE_URL;
const LOCAL_MODEL = `${BASE}models/hand_landmarker.task`;
const REMOTE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

let imageLm: Promise<HandLandmarker> | null = null;
let videoLm: Promise<HandLandmarker> | null = null;

/** Prefer the copy served by this site; fall back to Google's model URL. */
export async function modelPath(local = LOCAL_MODEL, remote = REMOTE_MODEL): Promise<string> {
  try {
    const r = await fetch(local, { method: 'HEAD' });
    // some static hosts answer missing files with the SPA's index.html
    if (r.ok && !(r.headers.get('content-type') ?? '').includes('text/html')) return local;
  } catch {
    /* fall through */
  }
  return remote;
}

async function create(mode: 'IMAGE' | 'VIDEO', numHands: number): Promise<HandLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(`${BASE}mediapipe/wasm`);
  const modelAssetPath = await modelPath();
  const opts = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath, delegate },
    runningMode: mode,
    numHands,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  try {
    return await HandLandmarker.createFromOptions(fileset, opts('GPU'));
  } catch {
    return await HandLandmarker.createFromOptions(fileset, opts('CPU'));
  }
}

// a failed load is not cached, so the user can retry
export function getImageLandmarker() {
  return (imageLm ??= create('IMAGE', 2).catch((e) => { imageLm = null; throw e; }));
}
export function getVideoLandmarker() {
  return (videoLm ??= create('VIDEO', 2).catch((e) => { videoLm = null; throw e; }));
}

export interface DetectedHand {
  landmarks: Pt[]; // pixels
  world: Pt[];
  side: HandSide;
  score: number;
}

/**
 * MediaPipe reports handedness assuming a mirrored (selfie) image.
 * `mirrored` = whether the pixels we passed are mirrored like a selfie preview.
 */
export function toHands(res: HandLandmarkerResult, w: number, h: number, mirrored: boolean): DetectedHand[] {
  return res.landmarks.map((lms, i) => {
    const cat = res.handedness[i]?.[0];
    let side: HandSide = cat?.categoryName === 'Left' ? 'left' : 'right';
    if (!mirrored) side = side === 'left' ? 'right' : 'left';
    return {
      landmarks: lms.map((p) => ({ x: p.x * w, y: p.y * h, z: p.z * w })),
      world: res.worldLandmarks[i]?.map((p) => ({ x: p.x, y: p.y, z: p.z })) ?? [],
      side,
      score: cat?.score ?? 0,
    };
  });
}

export async function detectInImage(canvas: HTMLCanvasElement): Promise<DetectedHand[]> {
  const lm = await getImageLandmarker();
  const res = lm.detect(canvas);
  return toHands(res, canvas.width, canvas.height, false);
}
