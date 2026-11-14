// Copies the MediaPipe WASM runtime into public/ so the site self-hosts it
// (no third-party CDN needed at runtime).
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const dst = join(root, 'public/mediapipe/wasm');
mkdirSync(dst, { recursive: true });
for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) cpSync(join(src, f), join(dst, f));
console.log('MediaPipe WASM copied to public/mediapipe/wasm');
