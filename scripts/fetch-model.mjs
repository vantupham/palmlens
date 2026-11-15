// Downloads the MediaPipe models into public/models so the deployed site serves
// them from its own origin. Run in CI before `npm run build`.
// If this step is skipped, the app falls back to Google's model URLs at runtime.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODELS = {
  'hand_landmarker.task':
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  // ~230 KB, used only to count faces in the two-hand heart game
  'blaze_face_short_range.tflite':
    'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
};
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'public/models');
mkdirSync(dir, { recursive: true });

for (const [name, url] of Object.entries(MODELS)) {
  const file = join(dir, name);
  if (existsSync(file)) { console.log('Model already present:', file); continue; }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Model download failed (${name}): ${res.status}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log('Model saved to', file);
}
