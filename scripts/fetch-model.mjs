// Downloads the MediaPipe hand landmark model into public/models so the
// deployed site serves it from its own origin. Run in CI before `npm run build`.
// If this step is skipped, the app falls back to Google's model URL at runtime.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'public/models');
const file = join(dir, 'hand_landmarker.task');

if (existsSync(file)) {
  console.log('Model already present:', file);
} else {
  mkdirSync(dir, { recursive: true });
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`Model download failed: ${res.status}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log('Model saved to', file);
}
