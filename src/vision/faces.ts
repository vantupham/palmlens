/**
 * Counts faces in the camera preview (heart game only). Runs locally; only the
 * number of faces is used — nothing is stored or sent. Optional: if the model
 * cannot load, the game falls back to hand geometry alone.
 */
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import { modelPath } from './landmarker';

const BASE = import.meta.env.BASE_URL;
let detector: Promise<FaceDetector | null> | null = null;

export function getFaceDetector(): Promise<FaceDetector | null> {
  return (detector ??= (async () => {
    try {
      const fileset = await FilesetResolver.forVisionTasks(`${BASE}mediapipe/wasm`);
      const modelAssetPath = await modelPath(
        `${BASE}models/blaze_face_short_range.tflite`,
        'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
      );
      return await FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath, delegate: 'CPU' },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.6,
      });
    } catch (e) {
      console.warn('Face detector unavailable; using hand geometry only.', e);
      return null;
    }
  })());
}

export function countFaces(d: FaceDetector, frame: HTMLVideoElement, ts: number): number {
  try {
    return d.detectForVideo(frame, ts).detections.length;
  } catch {
    return -1;
  }
}
