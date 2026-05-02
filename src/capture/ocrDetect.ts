import type { ImageLike, Worker } from 'tesseract.js';
import { minWordDistance, normalizeOcrLatinChars } from '../utils/fuzzyText';
import type { DetectionResult, ROI } from './types';

type PageSegmentationMode = Parameters<Worker['setParameters']>[0]['tessedit_pageseg_mode'];
type CanvasLike = {
  width: number;
  height: number;
  getContext: (type: '2d') => {
    getImageData: (sx: number, sy: number, sw: number, sh: number) => {
      data: Uint8ClampedArray;
    };
  } | null;
};

export interface ImagePixels {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

export type ResultScreenFeatureClassification =
  | { kind: 'result'; result: DetectionResult }
  | { kind: 'possible' }
  | { kind: 'none' };

const PSM_SINGLE_BLOCK = '6' as PageSegmentationMode;
const PSM_SINGLE_LINE = '7' as PageSegmentationMode;
const PSM_SINGLE_WORD = '8' as PageSegmentationMode;

export const MIN_RESULT_CONFIDENCE = 60;
const CLEAR_RESULT_TEXT_CONFIDENCE = 85;
const IMAGE_FEATURE_CONFIDENCE = 92;
const MIN_RESULT_BBOX_DENSITY = 0.35;
const MIN_POSSIBLE_RESULT_DENSITY = 0.035;
const MIN_POSSIBLE_RESULT_BBOX_DENSITY = 0.28;
const MIN_VICTORY_BANNER_WIDTH_RATIO = 0.75;

const RESULT_BANNER_ROI: ROI = {
  x: 0.02,
  y: 0.25,
  width: 0.96,
  height: 0.36,
};

/** VICTORY / LOSE のいずれかと完全一致（または正規化後一致）する場合に confidence を 85 に引き上げる。 */
function confidenceWithTextMatch(text: string, confidence: number): number {
  const upper = text.toUpperCase();
  const norm = normalizeOcrLatinChars(text);
  if (
    upper.includes('VICTORY') || norm.includes('VICTORY') ||
    upper.includes('LOSE') || norm.includes('LOSE')
  ) {
    return Math.max(confidence, CLEAR_RESULT_TEXT_CONFIDENCE);
  }
  return confidence;
}

/**
 * OCR テキストと信頼度から勝敗を判定する。
 *
 * マッチング優先順:
 *   1. 完全一致（toUpperCase().includes）
 *   2. OCR 文字正規化後の一致（0→O / 1→I / 5→S など）
 *   3. 単語レベルのファジーマッチ（Levenshtein ≤ 1）※ confidence boost なし
 */
export function parseDetectionResult(
  text: string,
  confidence: number,
): DetectionResult | null {
  if (confidence < MIN_RESULT_CONFIDENCE) return null;

  const upper = text.toUpperCase();

  // 1. 完全一致
  if (upper.includes('VICTORY')) return { result: 'win', confidence };
  if (upper.includes('LOSE')) return { result: 'loss', confidence };

  // 2. 正規化後の一致（0→O, 1→I, 5→S 等）
  const norm = normalizeOcrLatinChars(text);
  if (norm.includes('VICTORY')) return { result: 'win', confidence };
  if (norm.includes('LOSE')) return { result: 'loss', confidence };

  // 3. ファジーワードマッチ（Levenshtein ≤ 1）- confidence boost なし
  if (minWordDistance(upper, 'VICTORY') <= 1) return { result: 'win', confidence };
  if (minWordDistance(upper, 'LOSE') <= 1) return { result: 'loss', confidence };

  return null;
}

export function roiToRectangle(
  roi: ROI,
  imageWidth: number,
  imageHeight: number,
) {
  return {
    left: Math.floor(roi.x * imageWidth),
    top: Math.floor(roi.y * imageHeight),
    width: Math.floor(roi.width * imageWidth),
    height: Math.floor(roi.height * imageHeight),
  };
}

function isCanvasLike(input: ImageLike): input is ImageLike & CanvasLike {
  return (
    typeof input === 'object' &&
    input !== null &&
    'width' in input &&
    'height' in input &&
    'getContext' in input &&
    typeof (input as CanvasLike).getContext === 'function'
  );
}

function getCanvasPixels(input: CanvasLike): ImagePixels | null {
  const ctx = input.getContext('2d');
  if (!ctx) return null;

  const { width, height } = input;
  const imageData = ctx.getImageData(0, 0, width, height);
  return { width, height, data: imageData.data };
}

function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    data[offset] * 0x1000000 +
    ((data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3])
  );
}

function readAscii(data: Uint8Array, start: number, end: number): string {
  let result = '';
  for (let i = start; i < end; i++) result += String.fromCharCode(data[i]);
  return result;
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function unfilterPngScanlines(
  inflated: Uint8Array,
  width: number,
  height: number,
  bytesPerPixel: number,
): Uint8Array {
  const stride = width * bytesPerPixel;
  const out = new Uint8Array(stride * height);
  let srcOffset = 0;

  for (let y = 0; y < height; y++) {
    const filter = inflated[srcOffset++];
    const rowOffset = y * stride;
    const prevRowOffset = rowOffset - stride;

    for (let x = 0; x < stride; x++) {
      const raw = inflated[srcOffset++];
      const left = x >= bytesPerPixel ? out[rowOffset + x - bytesPerPixel] : 0;
      const up = y > 0 ? out[prevRowOffset + x] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? out[prevRowOffset + x - bytesPerPixel] : 0;

      let value: number;
      switch (filter) {
        case 0:
          value = raw;
          break;
        case 1:
          value = raw + left;
          break;
        case 2:
          value = raw + up;
          break;
        case 3:
          value = raw + Math.floor((left + up) / 2);
          break;
        case 4: {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
          value = raw + predictor;
          break;
        }
        default:
          throw new Error(`Unsupported PNG filter: ${filter}`);
      }
      out[rowOffset + x] = value & 0xff;
    }
  }

  return out;
}

async function readPngPixels(filepath: string): Promise<ImagePixels | null> {
  if (!filepath.toLowerCase().endsWith('.png')) return null;

  const dynamicImport = (specifier: string) => import(/* @vite-ignore */ specifier);
  const [fsModule, zlibModule] = await Promise.all([
    dynamicImport('node:fs'),
    dynamicImport('node:zlib'),
  ]);
  const { readFileSync } = fsModule as { readFileSync: (path: string) => Uint8Array };
  const { inflateSync } = zlibModule as { inflateSync: (data: Uint8Array) => Uint8Array };
  const file = readFileSync(filepath);
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  if (!pngSignature.every((byte, i) => file[i] === byte)) {
    return null;
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Uint8Array[] = [];

  while (offset + 12 <= file.length) {
    const length = readUint32BE(file, offset);
    const type = readAscii(file, offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > file.length) return null;

    if (type === 'IHDR') {
      width = readUint32BE(file, dataStart);
      height = readUint32BE(file, dataStart + 4);
      bitDepth = file[dataStart + 8];
      colorType = file[dataStart + 9];
    } else if (type === 'IDAT') {
      idatChunks.push(file.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }

    offset = dataEnd + 4;
  }

  if (!width || !height || bitDepth !== 8 || colorType !== 6 || idatChunks.length === 0) {
    return null;
  }

  const inflated = inflateSync(concatUint8Arrays(idatChunks));
  const data = unfilterPngScanlines(inflated, width, height, 4);
  return { width, height, data };
}

export async function readImagePixels(input: ImageLike): Promise<ImagePixels | null> {
  try {
    if (typeof input === 'string') return await readPngPixels(input);
    if (isCanvasLike(input)) return getCanvasPixels(input);
  } catch {
    return null;
  }
  return null;
}

function isResultTextPixel(data: ImagePixels['data'], offset: number): boolean {
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const a = data[offset + 3];
  if (a < 180) return false;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
  return brightness >= 205 && max >= 225 && max - min <= 95;
}

export async function detectResultByImageFeatures(input: ImageLike): Promise<DetectionResult | null> {
  const classification = await classifyResultScreenByImageFeatures(input);
  return classification.kind === 'result' ? classification.result : null;
}

export async function classifyResultScreenByImageFeatures(
  input: ImageLike,
): Promise<ResultScreenFeatureClassification> {
  const pixels = await readImagePixels(input);
  if (!pixels) return { kind: 'possible' };

  const rect = roiToRectangle(RESULT_BANNER_ROI, pixels.width, pixels.height);
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(pixels.width, rect.left + rect.width);
  const bottom = Math.min(pixels.height, rect.top + rect.height);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return { kind: 'possible' };

  const cols = new Uint16Array(width);
  const rows = new Uint16Array(height);
  let brightPixels = 0;

  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const offset = (y * pixels.width + x) * 4;
      if (!isResultTextPixel(pixels.data, offset)) continue;
      brightPixels += 1;
      cols[x - left] += 1;
      rows[y - top] += 1;
    }
  }

  const density = brightPixels / (width * height);
  if (density < MIN_POSSIBLE_RESULT_DENSITY) return { kind: 'none' };

  const colThreshold = Math.max(4, Math.floor(height * 0.035));
  const rowThreshold = Math.max(6, Math.floor(width * 0.025));
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;

  for (let x = 0; x < width; x++) {
    if (cols[x] >= colThreshold) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
  }
  for (let y = 0; y < height; y++) {
    if (rows[y] >= rowThreshold) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return { kind: 'none' };

  const bannerWidthRatio = (maxX - minX + 1) / pixels.width;
  const bannerHeightRatio = (maxY - minY + 1) / pixels.height;
  const centerX = (left + minX + left + maxX) / 2 / pixels.width;
  const centerY = (top + minY + top + maxY) / 2 / pixels.height;
  const bboxDensity = brightPixels / ((maxX - minX + 1) * (maxY - minY + 1));

  if (
    bannerHeightRatio < 0.08 ||
    bannerHeightRatio > 0.34 ||
    centerX < 0.35 ||
    centerX > 0.65 ||
    centerY < 0.35 ||
    centerY > 0.55 ||
    bboxDensity < MIN_RESULT_BBOX_DENSITY
  ) {
    if (
      bannerHeightRatio >= 0.10 &&
      bannerHeightRatio <= 0.34 &&
      centerX >= 0.35 &&
      centerX <= 0.65 &&
      centerY >= 0.35 &&
      centerY <= 0.56 &&
      bboxDensity >= MIN_POSSIBLE_RESULT_BBOX_DENSITY
    ) {
      return { kind: 'possible' };
    }
    return { kind: 'none' };
  }

  if (bannerWidthRatio >= MIN_VICTORY_BANNER_WIDTH_RATIO) {
    return {
      kind: 'result',
      result: { result: 'win', confidence: IMAGE_FEATURE_CONFIDENCE },
    };
  }
  if (bannerWidthRatio >= 0.24 && bannerWidthRatio <= 0.50) {
    return {
      kind: 'result',
      result: { result: 'loss', confidence: IMAGE_FEATURE_CONFIDENCE },
    };
  }

  return { kind: 'possible' };
}

export async function createOcrWorker(): Promise<Worker> {
  const { createWorker } = await import('tesseract.js');
  return createWorker('eng');
}

/**
 * 既存 worker を使って 2 パス OCR でテキストを認識する。
 * パス1: VICTORY ROI（中央帯）を PSM 8 でスキャン。
 * パス2: 同じ ROI を PSM 7 でスキャン → LOSE を検出。
 * パス3: 全体を PSM 6（単一ブロック）でスキャン。
 */
export async function detectWithOcrWorker(
  worker: Worker,
  input: ImageLike,
  imageWidth?: number,
  imageHeight?: number,
): Promise<DetectionResult | null> {
  const imageFeatureResult = await classifyResultScreenByImageFeatures(input);
  if (imageFeatureResult.kind === 'result') return imageFeatureResult.result;
  if (imageFeatureResult.kind === 'none') return null;

  if (imageWidth && imageHeight) {
    const rect = {
      left: Math.floor(0.125 * imageWidth),
      top: Math.floor(0.30 * imageHeight),
      width: Math.floor(0.75 * imageWidth),
      height: Math.floor(0.32 * imageHeight),
    };
    // パス1: PSM 8（単一ワード）+ ROI - VICTORY のような 1 ワード大テキストに最適
    await worker.setParameters({ tessedit_pageseg_mode: PSM_SINGLE_WORD });
    const { data: d1 } = await worker.recognize(input, { rectangle: rect });
    const r1 = parseDetectionResult(d1.text, confidenceWithTextMatch(d1.text, d1.confidence));
    if (r1) return r1;

    // パス2: PSM 7（単一行）+ ROI - ROI 内の LOSE 検出向け
    await worker.setParameters({ tessedit_pageseg_mode: PSM_SINGLE_LINE });
    const { data: d2 } = await worker.recognize(input, { rectangle: rect });
    const r2 = parseDetectionResult(d2.text, confidenceWithTextMatch(d2.text, d2.confidence));
    if (r2) return r2;
  }

  // パス3: PSM 6（単一ブロック）+ 全画像 - ROI で検出できない LOSE 向けフォールバック
  await worker.setParameters({ tessedit_pageseg_mode: PSM_SINGLE_BLOCK });
  const { data: d3 } = await worker.recognize(input);
  return parseDetectionResult(d3.text, confidenceWithTextMatch(d3.text, d3.confidence));
}

/**
 * 単発 OCR 用 API。キャプチャ中は useOcrDetector 側で worker を使い回す。
 */
export async function detectFromImageLike(
  input: ImageLike,
  imageWidth?: number,
  imageHeight?: number,
): Promise<DetectionResult | null> {
  const worker = await createOcrWorker();

  try {
    return await detectWithOcrWorker(worker, input, imageWidth, imageHeight);
  } finally {
    await worker.terminate();
  }
}
