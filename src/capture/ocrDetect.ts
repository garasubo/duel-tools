import type { ImageLike, Worker } from 'tesseract.js';
import { minWordDistance, normalizeOcrLatinChars } from '../utils/fuzzyText';
import { measureAsync } from './captureProfiler';
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

type DrawableSource = CanvasImageSource & { width: number; height: number };

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
const MIN_VICTORY_DENSITY = 0.268;
// 第1 VICTORY 分岐の背景パターン除外用。
// 本物の VICTORY 文字は bbox 下部 2/3 に集中するため、上部 1/3 の明ピクセルは
// 中央 1/3 に比べ非常に少ない（true win は ≤0.103）。一定割合以上あれば背景/演出由来
// とみなす。0092.png のような非結果フレーム（top/mid=0.275）を弾くため 0.5→0.2 に
// 引き締めた。閾値 0.2 は true win(≤0.103) と false positive(0.275) の間に余裕を持つ。
const MAX_VICTORY_TOP_THIRD_RATIO = 0.2;
// 低密度 VICTORY 分岐（density<MIN_VICTORY_DENSITY のワイドバナー）用。本物の VICTORY は
// bbox 上部 1/3 が中央 1/3 と同等以上に密（全 fixture で t3/m3 ≥ 1.43）。0094.png のような
// 背景の横ストリーク（t3/m3 ≈ 0.61）を弾く。しきい値 1.0 は true win(≥1.43) と
// false positive(0.61) のほぼ中点。下部輝度は使わない（明るい下部の本物 0096 を救うため）。
const MIN_VICTORY_LOWDENSITY_TOP_THIRD_RATIO = 1.0;
const MIN_POSSIBLE_RESULT_BBOX_DENSITY = 0.28;
const MIN_VICTORY_BANNER_WIDTH_RATIO = 0.75;
const MIN_LOSS_BANNER_WIDTH_RATIO = 0.23;
const MAX_LOSS_BANNER_HEIGHT_RATIO = 0.20;
const MIN_LOSS_BANNER_HEIGHT_RATIO = 0.12;
const MAX_LOSS_BANNER_WIDTH_RATIO = 0.50;
// 明るい背景で LOSE バナーの bbox が膨張したとき、列/行のピークに対するこの割合を
// 閾値にしてタイトな bbox を取り直し、LOSE のコア文字を切り出す（0085.png のような
// 明るい盤面背景での取りこぼし対策）。
const LOSS_CORE_THRESHOLD_RATIO = 0.35;
// 本物 LOSE グリフ核に合わせた閾値。古い capture では核がやや細い/薄い一方、
// RESOLVE などの横長演出は幅・アスペクト比で弾ける。
const MAX_LOSS_CORE_WIDTH_RATIO = 0.40; // 0085=0.302 通過 / 0086=0.493 棄却
const MIN_LOSS_CORE_DENSITY = 0.38; // 0026=0.399 通過 / RESOLVE 0105 は幅・aspect で棄却
// LOSE は 4 文字で横長（核アスペクト比 幅/高さ ≈ 2.2）。正方形に近い明るいブロブ
// （爆発エフェクト等）を弾く形状ガード。本物 LOSE は全例 1.70〜2.25。
const MIN_LOSS_CORE_ASPECT_RATIO = 1.6;
// 本物 LOSE のコアは全 fixture で幅/高さ ≈ 1.70〜2.25。横長すぎる帯（ゲームプレイ中の
// 明るい横ストリーク等、0095.png はアスペクト 3.07）を弾くため上限を設ける。
const MAX_LOSS_CORE_ASPECT_RATIO = 2.6;
// 救済パスで確定した loss の信頼度。鮮明な LOSE（IMAGE_FEATURE_CONFIDENCE=92）より一段低くし、
// ストリーク層の getRequiredConsecutive で 2 フレーム連続一致を要求させる（1 フレーム即確定にしない）。
const LOSS_FALLBACK_CONFIDENCE = 88; // 85 <= 88 < 92 → getRequiredConsecutive = 2

const RESULT_BANNER_ROI: ROI = {
  x: 0.02,
  y: 0.25,
  width: 0.96,
  height: 0.36,
};

// 結果画面の OK ボタンが表示される画面下部領域
// 結果画面はこの領域が暗いオーバーレイで覆われており、ゲームプレイ中は明るいゲームコンテンツが表示される
const RESULT_BOTTOM_ROI: ROI = {
  x: 0.30,
  y: 0.85,
  width: 0.40,
  height: 0.08,
};
const MAX_RESULT_BOTTOM_BRIGHTNESS = 80;
const MAX_LOSE_RESULT_BOTTOM_BRIGHTNESS = 90;

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

/**
 * 結果画面 OCR 用の入力画像を作る。
 * - 入力がブラウザ canvas の場合は ROI 部分だけを縮小コピーした小さい canvas を返す
 *   （Tesseract.js が画像全体を毎回前処理するコストを避ける）。
 * - 入力が文字列（テストの PNG パス）など canvas でない場合は従来通り
 *   `worker.recognize(input, { rectangle })` で扱えるよう rectangle を返す。
 */
export interface OcrInput {
  input: ImageLike;
  rectangle?: { left: number; top: number; width: number; height: number };
}

export function buildOcrInput(
  input: ImageLike,
  rect: { left: number; top: number; width: number; height: number },
  reusableCanvas: HTMLCanvasElement | null,
  targetWidth: number,
): { ocrInput: OcrInput; reusableCanvas: HTMLCanvasElement | null } {
  if (
    typeof document === 'undefined' ||
    typeof HTMLCanvasElement === 'undefined' ||
    !(input instanceof HTMLCanvasElement)
  ) {
    return { ocrInput: { input, rectangle: rect }, reusableCanvas };
  }

  const scale = rect.width > targetWidth ? targetWidth / rect.width : 1;
  const dstWidth = Math.max(1, Math.floor(rect.width * scale));
  const dstHeight = Math.max(1, Math.floor(rect.height * scale));

  const canvas = reusableCanvas ?? document.createElement('canvas');
  canvas.width = dstWidth;
  canvas.height = dstHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { ocrInput: { input, rectangle: rect }, reusableCanvas: canvas };
  }
  ctx.drawImage(
    input as DrawableSource,
    rect.left,
    rect.top,
    rect.width,
    rect.height,
    0,
    0,
    dstWidth,
    dstHeight,
  );
  return { ocrInput: { input: canvas as unknown as ImageLike }, reusableCanvas: canvas };
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

/**
 * OK ボタン領域（画面下部中央）の平均輝度が低いかチェックする。
 * 結果画面はこの領域がオーバーレイで暗くなるが、ゲームプレイ中の演出フレームは
 * カードや盤面コンテンツで明るい。
 */
export function hasResultScreenBottomDark(pixels: ImagePixels, maxBrightness = MAX_RESULT_BOTTOM_BRIGHTNESS): boolean {
  const rect = roiToRectangle(RESULT_BOTTOM_ROI, pixels.width, pixels.height);
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(pixels.width, rect.left + rect.width);
  const bottom = Math.min(pixels.height, rect.top + rect.height);
  if (right <= left || bottom <= top) return true; // ピクセル読み取り不可の場合は安全側に倒す

  let totalBrightness = 0;
  let count = 0;
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const offset = (y * pixels.width + x) * 4;
      const r = pixels.data[offset];
      const g = pixels.data[offset + 1];
      const b = pixels.data[offset + 2];
      const a = pixels.data[offset + 3];
      if (a < 128) continue;
      totalBrightness += 0.299 * r + 0.587 * g + 0.114 * b;
      count++;
    }
  }
  if (count === 0) return true;
  return totalBrightness / count < maxBrightness;
}

export async function detectResultByImageFeatures(input: ImageLike): Promise<DetectionResult | null> {
  const classification = await classifyResultScreenByImageFeatures(input);
  return classification.kind === 'result' ? classification.result : null;
}

function countBrightPixelsInRect(
  pixels: ImagePixels,
  left: number,
  top: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): number {
  let count = 0;
  for (let y = top + y0; y <= top + y1; y++) {
    for (let x = left + x0; x <= left + x1; x++) {
      if (isResultTextPixel(pixels.data, (y * pixels.width + x) * 4)) count += 1;
    }
  }
  return count;
}

/**
 * 列/行のピーク比でタイトな bbox を取り直し、中央に「LOSE」グリフ核（幅 0.24-0.40・
 * 高さ 0.12-0.20・横長アスペクト・高密度）があるかを判定する。
 *
 * 画面下部の暗転（OK ボタン領域の輝度）には依存しない。明るい結果画面では OK ボタンの
 * プログレスバーが下部 ROI 中央を照らし暗転判定を defeat するため（0088=107 / 0091=135）、
 * 取りこぼしの原因になっていた。核シグネチャ自体が十分に特異で、全 fixture の true loss と
 * negative/win を分離できることを確認済み。暗転の有無は呼び出し側で信頼度（92/88）に反映する。
 */
function detectLossCoreByTightBbox(
  pixels: ImagePixels,
  cols: Uint16Array,
  rows: Uint16Array,
  left: number,
  top: number,
  colThreshold: number,
  rowThreshold: number,
): boolean {
  const width = cols.length;
  const height = rows.length;
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
  if (maxX < minX || maxY < minY) return false;

  const bboxW = maxX - minX + 1;
  const bboxH = maxY - minY + 1;
  const widthRatio = bboxW / pixels.width;
  const heightRatio = bboxH / pixels.height;
  const centerX = (left + minX + left + maxX) / 2 / pixels.width;
  const centerY = (top + minY + top + maxY) / 2 / pixels.height;
  const brightPixels = countBrightPixelsInRect(pixels, left, top, minX, maxX, minY, maxY);
  const bboxDensity = brightPixels / (bboxW * bboxH);

  return (
    widthRatio >= MIN_LOSS_BANNER_WIDTH_RATIO &&
    widthRatio <= MAX_LOSS_CORE_WIDTH_RATIO &&
    heightRatio >= MIN_LOSS_BANNER_HEIGHT_RATIO &&
    heightRatio <= MAX_LOSS_BANNER_HEIGHT_RATIO &&
    widthRatio / heightRatio >= MIN_LOSS_CORE_ASPECT_RATIO &&
    widthRatio / heightRatio <= MAX_LOSS_CORE_ASPECT_RATIO &&
    centerX >= 0.35 &&
    centerX <= 0.65 &&
    centerY >= 0.35 &&
    centerY <= 0.55 &&
    bboxDensity >= MIN_LOSS_CORE_DENSITY
  );
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

  // 列/行のピーク比でタイトな bbox を取り直すための閾値。LOSE コア判定（明るい背景の
  // 救済を含む）で normal/rescue 双方の分岐から使う。
  let peakCol = 0;
  for (let x = 0; x < width; x++) if (cols[x] > peakCol) peakCol = cols[x];
  let peakRow = 0;
  for (let y = 0; y < height; y++) if (rows[y] > peakRow) peakRow = rows[y];
  const tightColThreshold = Math.max(colThreshold, Math.floor(peakCol * LOSS_CORE_THRESHOLD_RATIO));
  const tightRowThreshold = Math.max(rowThreshold, Math.floor(peakRow * LOSS_CORE_THRESHOLD_RATIO));

  if (bannerWidthRatio >= MIN_VICTORY_BANNER_WIDTH_RATIO && density >= MIN_VICTORY_DENSITY) {
    // VICTORY text appears in the lower portion of the ROI; if the top third of the
    // bounding box has as many bright pixels as the middle third, the signal is from
    // background content (e.g. ceiling/sky pattern), not text.
    const bboxH = maxY - minY + 1;
    const third = Math.max(1, Math.floor(bboxH / 3));
    let topThirdPixels = 0;
    let midThirdPixels = 0;
    for (let ry = minY; ry < minY + third; ry++) topThirdPixels += rows[ry];
    for (let ry = minY + third; ry < minY + 2 * third; ry++) midThirdPixels += rows[ry];
    if (topThirdPixels >= midThirdPixels * MAX_VICTORY_TOP_THIRD_RATIO) {
      return { kind: 'none' };
    }
    return {
      kind: 'result',
      result: { result: 'win', confidence: IMAGE_FEATURE_CONFIDENCE },
    };
  }

  // フォールバック: loose な bbox が LOSE 帯より広い（0.50 超）が VICTORY には満たない
  // （明るい背景でノイズ膨張した）場合、タイト bbox を取り直して LOSE コアを判定する。
  // 通常の LOSE（幅 ≤0.50）や VICTORY はこの分岐に入らない。
  if (
    bannerWidthRatio > MAX_LOSS_BANNER_WIDTH_RATIO &&
    bannerWidthRatio < MIN_VICTORY_BANNER_WIDTH_RATIO &&
    // 本物の LOSE バナーはルーズ bbox 全体も水平中央寄せ（真陽性 0085=0.443 / 0091=0.542）。
    // タイト核だけ中央に collapse する左寄り演出（0097.png「DUEL!」スプラッシュ centerX=0.338）を
    // 弾く。main path（centerX∈[0.35,0.65]）と同じ「結果バナーは中央寄せ」原則を rescue 分岐にも適用。
    centerX >= 0.40 &&
    centerX <= 0.60 &&
    detectLossCoreByTightBbox(pixels, cols, rows, left, top, tightColThreshold, tightRowThreshold)
  ) {
    return {
      kind: 'result',
      result: { result: 'loss', confidence: LOSS_FALLBACK_CONFIDENCE },
    };
  }

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
      if (!hasResultScreenBottomDark(pixels)) return { kind: 'none' };
      return { kind: 'possible' };
    }
    return { kind: 'none' };
  }

  if (bannerWidthRatio >= MIN_VICTORY_BANNER_WIDTH_RATIO) {
    // 低密度のワイドバナー。本物 VICTORY 文字は上部 1/3 が密（top-heavy, t3/m3 ≥ 1.43）。
    // 0094.png のような背景の横ストリーク（t3/m3 ≈ 0.61）はこれを満たさないので棄却する。
    // 下部輝度は判定に使わない（明るい下部の本物 VICTORY 0096 を取りこぼすため）。
    const bboxH = maxY - minY + 1;
    const third = Math.max(1, Math.floor(bboxH / 3));
    let topThirdPixels = 0;
    let midThirdPixels = 0;
    for (let ry = minY; ry < minY + third; ry++) topThirdPixels += rows[ry];
    for (let ry = minY + third; ry < minY + 2 * third; ry++) midThirdPixels += rows[ry];
    if (topThirdPixels < midThirdPixels * MIN_VICTORY_LOWDENSITY_TOP_THIRD_RATIO) {
      return { kind: 'none' };
    }
    return {
      kind: 'result',
      result: { result: 'win', confidence: IMAGE_FEATURE_CONFIDENCE },
    };
  }
  if (
    bannerWidthRatio >= MIN_LOSS_BANNER_WIDTH_RATIO &&
    bannerWidthRatio <= MAX_LOSS_BANNER_WIDTH_RATIO &&
    bannerHeightRatio >= MIN_LOSS_BANNER_HEIGHT_RATIO &&
    bannerHeightRatio <= MAX_LOSS_BANNER_HEIGHT_RATIO
  ) {
    const hasLossCore = detectLossCoreByTightBbox(
      pixels,
      cols,
      rows,
      left,
      top,
      tightColThreshold,
      tightRowThreshold,
    );

    if (!hasLossCore) return { kind: 'possible' };

    // 下部領域が明るい場合（OK ボタンのプログレスバー等で暗転確定できない）でも、
    // 中央に強い LOSE 核があれば一段低い信頼度（2 フレーム連続要求）で確定する。
    if (!hasResultScreenBottomDark(pixels, MAX_LOSE_RESULT_BOTTOM_BRIGHTNESS)) {
      return {
        kind: 'result',
        result: { result: 'loss', confidence: LOSS_FALLBACK_CONFIDENCE },
      };
    }
    return {
      kind: 'result',
      result: { result: 'loss', confidence: IMAGE_FEATURE_CONFIDENCE },
    };
  }

  if (!hasResultScreenBottomDark(pixels)) return { kind: 'none' };
  return { kind: 'possible' };
}

export async function createOcrWorker(): Promise<Worker> {
  const { createWorker } = await import('tesseract.js');
  return createWorker('eng');
}

const RESULT_OCR_TARGET_WIDTH = 800;
// パス1/2 で「文字は読めているが VICTORY/LOSE と一致しなかった」場合は
// パス3（全画像 PSM 6）を回しても無駄にコストがかかるだけなので、
// 文字数が極端に少ないとき（OCR が空振り）に限ってフォールバックする。
const PASS3_TRIGGER_TEXT_LENGTH = 2;

/**
 * 既存 worker を使って 2 パス OCR でテキストを認識する。
 * パス1: VICTORY ROI（中央帯）を PSM 8 でスキャン。
 * パス2: 同じ ROI を PSM 7 でスキャン → LOSE を検出。
 * パス3: 全体を PSM 6（単一ブロック）でスキャン。ROI で文字が拾えなかった場合のみ。
 */
export async function detectWithOcrWorker(
  worker: Worker,
  input: ImageLike,
  imageWidth?: number,
  imageHeight?: number,
  reusableCanvasRef?: { current: HTMLCanvasElement | null },
): Promise<DetectionResult | null> {
  const imageFeatureResult = await measureAsync('image-classify', () =>
    classifyResultScreenByImageFeatures(input),
  );
  if (imageFeatureResult.kind === 'result') return imageFeatureResult.result;
  if (imageFeatureResult.kind === 'none') return null;

  if (imageWidth && imageHeight) {
    const rect = {
      left: Math.floor(0.125 * imageWidth),
      top: Math.floor(0.30 * imageHeight),
      width: Math.floor(0.75 * imageWidth),
      height: Math.floor(0.32 * imageHeight),
    };
    const built = buildOcrInput(
      input,
      rect,
      reusableCanvasRef?.current ?? null,
      RESULT_OCR_TARGET_WIDTH,
    );
    if (reusableCanvasRef) reusableCanvasRef.current = built.reusableCanvas;
    const { input: ocrInput, rectangle } = built.ocrInput;
    const recognizeOpts = rectangle ? { rectangle } : undefined;

    // パス1: PSM 8（単一ワード）+ ROI - VICTORY のような 1 ワード大テキストに最適
    await worker.setParameters({ tessedit_pageseg_mode: PSM_SINGLE_WORD });
    const { data: d1 } = await worker.recognize(ocrInput, recognizeOpts);
    const r1 = parseDetectionResult(d1.text, confidenceWithTextMatch(d1.text, d1.confidence));
    if (r1) return r1;

    // パス2: PSM 7（単一行）+ ROI - ROI 内の LOSE 検出向け
    await worker.setParameters({ tessedit_pageseg_mode: PSM_SINGLE_LINE });
    const { data: d2 } = await worker.recognize(ocrInput, recognizeOpts);
    const r2 = parseDetectionResult(d2.text, confidenceWithTextMatch(d2.text, d2.confidence));
    if (r2) return r2;

    const trimmed1 = d1.text.trim().length;
    const trimmed2 = d2.text.trim().length;
    if (trimmed1 > PASS3_TRIGGER_TEXT_LENGTH || trimmed2 > PASS3_TRIGGER_TEXT_LENGTH) {
      // 文字は読めたが該当キーワードに一致しなかった → 演出フレーム等。フルパスは回さない。
      return null;
    }
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
