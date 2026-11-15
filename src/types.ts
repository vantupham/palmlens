export interface Pt {
  x: number;
  y: number;
  z?: number;
}

export type HandSide = 'left' | 'right';
export type LineKey = 'heart' | 'head' | 'life' | 'fate';
export type ElementKey = 'earth' | 'air' | 'water' | 'fire';
export type Lang = 'vi' | 'en';

/** One captured hand: the photo plus MediaPipe landmarks in image pixels. */
export interface HandCapture {
  image: HTMLCanvasElement;
  landmarks: Pt[]; // 21 points, image pixel coordinates
  world: Pt[] | null; // 21 points, metric 3D (MediaPipe world landmarks)
  side: HandSide;
  /** side as reported by the detector (may differ from what the user declared) */
  detected?: HandSide;
  source: 'camera' | 'upload' | 'demo';
  /** more frames of the same hand from a camera burst, averaged to reduce noise */
  extras?: { image: HTMLCanvasElement; landmarks: Pt[] }[];
  /** whether the palm (not the back of the hand) faced the camera, when it can be told */
  facing?: 'palm' | 'back' | 'unknown';
  /** show the photo mirrored (selfie camera), the way the user saw it while scanning */
  mirrored?: boolean;
}

export interface LineResult {
  key: LineKey;
  /** polyline in image pixels (only the detected segment) */
  img: Pt[];
  /** polyline in palm coordinates (u: radial+, v: wrist 0 → middle knuckle 1) */
  uv: Pt[];
  /** arc length relative to knuckle width */
  length: number;
  /** max deviation from the chord / chord length */
  curvature: number;
  /** 0..1 mean ridge strength along the segment */
  clarity: number;
  present: boolean;
  /** set when the user corrected this line by hand */
  edited?: boolean;
}

export interface Quality {
  brightness: number; // 0..1 mean luminance on palm
  contrast: number; // 0..1
  sharpness: number; // 0..1 normalised Laplacian variance
  ok: boolean;
  issues: ('dark' | 'bright' | 'blurry' | 'small')[];
}

export interface Metrics {
  fingerLen: { thumb: number; index: number; middle: number; ring: number; pinky: number };
  palmLength: number;
  palmWidth: number;
  /** index / ring finger length (approximation from joint landmarks) */
  digitRatio: number;
  /** palm length / knuckle width */
  palmRatio: number;
  /** middle finger / palm length */
  fingerRatio: number;
  /** thumb / index */
  thumbRatio: number;
  /** pinky tip passes ring finger's top joint (traditional "long Mercury finger") */
  longPinky: boolean;
  /** index finger longer than ring (in length) */
  indexLonger: boolean;
}

export interface Analysis {
  side: HandSide;
  source: HandCapture['source'];
  metrics: Metrics;
  lines: Record<LineKey, LineResult>;
  quality: Quality;
  element: ElementKey;
  /** position on the shape map, both roughly in -1..1 */
  shapeScore: { palm: number; fingers: number };
  archetype: number; // 0..2 sub-type within element (dominant line)
  singleCrease: boolean;
  confidence: number; // 0..1
  /** landmarks normalised to the palm frame for drawing stylised hands */
  norm: Pt[];
}

/** Compact, shareable profile (no image, only numbers). */
export interface Profile {
  n: string; // display name / nickname
  s: HandSide;
  e: ElementKey;
  a: number; // archetype
  r: number; // digit ratio
  pr: number; // palm ratio
  fr: number; // finger ratio
  h: [number, number, number]; // heart: length, curvature, clarity
  d: [number, number, number]; // head
  l: [number, number, number]; // life
  f: number; // fate clarity (0 = absent)
  k: number[]; // normalised landmarks, flattened x,y (rounded)
  ln?: number[][]; // heart, head, life polylines in palm coords, 8 points each, flattened
  g?: 'm' | 'f'; // optional self-declared sex for population reference only
}
