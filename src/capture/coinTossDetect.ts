import type { ImageLike, Worker } from 'tesseract.js';
import type { ROI } from './types';
import { buildOcrInput, readImagePixels, roiToRectangle } from './ocrDetect';

export type CoinTossScreen =
  | 'user-selecting'      // coin_win_NNN: 「先攻・後攻を選択してください」
  | 'opponent-selecting'  // coin_lose_NNN: 「対戦相手が先攻・後攻を選択しています」
  | 'you-are-first'       // coin_first_NNN: 「あなたが先攻です。」
  | 'you-are-second';     // coin_second_NNN: 「あなたが後攻です。」

// テキストが表示される下部帯領域（コイントス結果画面で使用）
const COIN_TOSS_TEXT_ROI: ROI = {
  x: 0.15,
  y: 0.65,
  width: 0.70,
  height: 0.20,
};

// 古い/別解像度のスクリーンショットではメッセージ帯が少し上に出る。
const COIN_TOSS_FALLBACK_TEXT_ROI: ROI = {
  x: 0.05,
  y: 0.50,
  width: 0.90,
  height: 0.28,
};

const COIN_TOSS_HIGH_TEXT_ROI: ROI = {
  x: 0.05,
  y: 0.45,
  width: 0.90,
  height: 0.25,
};

const COIN_TOSS_WIDE_TEXT_ROI: ROI = {
  x: 0.30,
  y: 0.61,
  width: 0.40,
  height: 0.12,
};

const COIN_TOSS_MESSAGE_FEATURE_ROI: ROI = {
  x: 0.25,
  y: 0.60,
  width: 0.50,
  height: 0.14,
};

// Tesseract.js は日本語テキストを認識する際に単語間にスペースを挿入することがある。
// スペースを除去してから判定する。
function normalizeOcrText(text: string): string {
  return text
    .replace(/[\s・、。，．.｡:：／/\\|｜\-ー―‐=＝_＿]+/g, '')
    .replace(/[「」『』（）()［］【】<>＜＞]+/g, '')
    .replaceAll('[', '')
    .replaceAll(']', '');
}

export function parseCoinTossText(text: string): CoinTossScreen | null {
  const normalized = normalizeOcrText(text);
  // 「選択してください」→ ユーザーが先攻/後攻を選択する画面（コイントス勝ち）
  if (
    normalized.includes('先攻') &&
    normalized.includes('後攻') &&
    normalized.includes('選択してください')
  ) {
    return 'user-selecting';
  }
  // 「対戦相手」→ 相手が選択中（コイントス負け）
  if (
    (normalized.includes('対戦相手') || normalized.includes('相手')) &&
    normalized.includes('選択')
  ) {
    return 'opponent-selecting';
  }
  // 「先攻で」→ あなたが先攻（「先攻です。」の「す」がOCRで欠落する場合も対応）
  if (normalized.includes('先攻で')) return 'you-are-first';
  if (normalized.includes('あなたが先') && normalized.includes('です')) return 'you-are-first';
  // 「後攻で」→ あなたが後攻
  if (normalized.includes('後攻で')) return 'you-are-second';
  if (normalized.includes('あなたが後') && normalized.includes('です')) return 'you-are-second';
  return null;
}

export async function createJpnOcrWorker(): Promise<Worker> {
  const { createWorker } = await import('tesseract.js');
  return createWorker('jpn');
}

interface CoinTossMessageFeatureStats {
  darkDensity: number;
  cyanDensity: number;
  blueDensity: number;
  textDensity: number;
}

function getCoinTossMessageFeatureStats(
  pixels: Awaited<ReturnType<typeof readImagePixels>>,
): CoinTossMessageFeatureStats | null {
  if (!pixels) return null;

  const rect = roiToRectangle(COIN_TOSS_MESSAGE_FEATURE_ROI, pixels.width, pixels.height);
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(pixels.width, rect.left + rect.width);
  const bottom = Math.min(pixels.height, rect.top + rect.height);
  if (right <= left || bottom <= top) return null;

  let total = 0;
  let dark = 0;
  let cyan = 0;
  let blue = 0;
  let text = 0;

  for (let y = top; y < bottom; y += 2) {
    for (let x = left; x < right; x += 2) {
      const offset = (y * pixels.width + x) * 4;
      const r = pixels.data[offset];
      const g = pixels.data[offset + 1];
      const b = pixels.data[offset + 2];
      const a = pixels.data[offset + 3];
      if (a < 180) continue;

      total += 1;
      const max = Math.max(r, g, b);
      if (max < 80) dark += 1;
      if (g > 90 && b > 100 && b > r * 1.4) cyan += 1;
      if (b > 100 && b > r * 1.2 && b > g * 1.05) blue += 1;
      if ((r > 190 && g > 190 && b > 190) || (r > 180 && g > 160 && b < 90)) {
        text += 1;
      }
    }
  }

  if (total === 0) return null;

  return {
    darkDensity: dark / total,
    cyanDensity: cyan / total,
    blueDensity: blue / total,
    textDensity: text / total,
  };
}

function hasCoinTossMessagePanel(stats: CoinTossMessageFeatureStats | null): boolean {
  if (!stats) return false;

  return (
    stats.darkDensity >= 0.60 &&
    stats.darkDensity <= 0.75 &&
    stats.cyanDensity >= 0.02 &&
    stats.cyanDensity <= 0.06 &&
    stats.blueDensity >= 0.10 &&
    stats.blueDensity <= 0.22 &&
    stats.textDensity >= 0.014
  );
}

export interface DetectCoinTossOptions {
  /** 直近ヒットした ROI を最初に試す。不一致だったら通常リストにフォールバック。 */
  preferredRoi?: ROI;
  /** ヒットした ROI を呼び元へ返してキャッシュ更新できるようにする。 */
  onRoiHit?: (roi: ROI) => void;
  /** OCR 入力に使う再利用キャンバス（ブラウザ canvas 入力時のみ）。 */
  reusableCanvasRef?: { current: HTMLCanvasElement | null };
}

const COIN_TOSS_OCR_TARGET_WIDTH = 960;

export async function detectCoinTossScreen(
  worker: Worker,
  input: ImageLike,
  imageWidth?: number,
  imageHeight?: number,
  options?: DetectCoinTossOptions,
): Promise<CoinTossScreen | null> {
  if (imageWidth && imageHeight) {
    const pixels = await readImagePixels(input);
    if (pixels && !hasCoinTossMessagePanel(getCoinTossMessageFeatureStats(pixels))) {
      return null;
    }

    const baseRois =
      imageWidth >= 1500
        ? [
            COIN_TOSS_WIDE_TEXT_ROI,
            COIN_TOSS_TEXT_ROI,
            COIN_TOSS_FALLBACK_TEXT_ROI,
            COIN_TOSS_HIGH_TEXT_ROI,
          ]
        : [
            COIN_TOSS_TEXT_ROI,
            COIN_TOSS_WIDE_TEXT_ROI,
            COIN_TOSS_FALLBACK_TEXT_ROI,
            COIN_TOSS_HIGH_TEXT_ROI,
          ];

    const preferred = options?.preferredRoi;
    const rois = preferred
      ? [preferred, ...baseRois.filter((r) => r !== preferred)]
      : baseRois;

    for (const roi of rois) {
      const rect = roiToRectangle(roi, imageWidth, imageHeight);
      const built = buildOcrInput(
        input,
        rect,
        options?.reusableCanvasRef?.current ?? null,
        COIN_TOSS_OCR_TARGET_WIDTH,
      );
      if (options?.reusableCanvasRef) {
        options.reusableCanvasRef.current = built.reusableCanvas;
      }
      const { input: ocrInput, rectangle } = built.ocrInput;
      const { data } = rectangle
        ? await worker.recognize(ocrInput, { rectangle })
        : await worker.recognize(ocrInput);
      const result = parseCoinTossText(data.text);
      if (result) {
        options?.onRoiHit?.(roi);
        return result;
      }
    }

    return null;
  }

  const { data } = await worker.recognize(input);
  return parseCoinTossText(data.text);
}

const IN_DUEL_BADGE_FEATURE_ROI: ROI = {
  x: 0.78,
  y: 0.43,
  width: 0.16,
  height: 0.18,
};

interface ColorBlobStats {
  roiDensity: number;
  blobDensity: number;
  blobWidthRatio: number;
  blobHeightRatio: number;
}

interface BlobAccumulator {
  count: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function emptyBlob(initialMinX: number, initialMinY: number): BlobAccumulator {
  return {
    count: 0,
    minX: initialMinX,
    minY: initialMinY,
    maxX: -1,
    maxY: -1,
  };
}

function finalizeBlob(
  blob: BlobAccumulator,
  width: number,
  height: number,
  imageWidth: number,
  imageHeight: number,
): ColorBlobStats | null {
  if (blob.maxX < blob.minX || blob.maxY < blob.minY) return null;
  const blobAreaW = blob.maxX - blob.minX + 1;
  const blobAreaH = blob.maxY - blob.minY + 1;
  return {
    roiDensity: blob.count / (width * height),
    blobDensity: blob.count / (blobAreaW * blobAreaH),
    blobWidthRatio: blobAreaW / imageWidth,
    blobHeightRatio: blobAreaH / imageHeight,
  };
}

interface BadgeBlobStats {
  gold: ColorBlobStats | null;
  red: ColorBlobStats | null;
  blue: ColorBlobStats | null;
  badgeColor: ColorBlobStats | null;
}

function getAllBadgeBlobStats(
  pixels: Awaited<ReturnType<typeof readImagePixels>>,
): BadgeBlobStats | null {
  if (!pixels) return null;

  const rect = roiToRectangle(IN_DUEL_BADGE_FEATURE_ROI, pixels.width, pixels.height);
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(pixels.width, rect.left + rect.width);
  const bottom = Math.min(pixels.height, rect.top + rect.height);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return null;

  const gold = emptyBlob(right, bottom);
  const red = emptyBlob(right, bottom);
  const blue = emptyBlob(right, bottom);
  const badgeColor = emptyBlob(right, bottom);

  const data = pixels.data;
  const rowStride = pixels.width * 4;

  for (let y = top; y < bottom; y++) {
    let offset = y * rowStride + left * 4;
    for (let x = left; x < right; x++, offset += 4) {
      const a = data[offset + 3];
      if (a < 180) continue;

      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];

      const isGold = r >= 120 && g >= 80 && r > b * 1.25 && g > b * 1.05;
      const isRed = r >= 95 && r > g * 1.35 && r > b * 1.15;
      const isBlue = b >= 100 && b > r * 1.25 && b > g * 1.05;

      if (isGold) {
        gold.count++;
        if (x < gold.minX) gold.minX = x;
        if (x > gold.maxX) gold.maxX = x;
        if (y < gold.minY) gold.minY = y;
        if (y > gold.maxY) gold.maxY = y;
      }
      if (isRed) {
        red.count++;
        if (x < red.minX) red.minX = x;
        if (x > red.maxX) red.maxX = x;
        if (y < red.minY) red.minY = y;
        if (y > red.maxY) red.maxY = y;
      }
      if (isBlue) {
        blue.count++;
        if (x < blue.minX) blue.minX = x;
        if (x > blue.maxX) blue.maxX = x;
        if (y < blue.minY) blue.minY = y;
        if (y > blue.maxY) blue.maxY = y;
      }
      if (isGold || isRed || isBlue) {
        badgeColor.count++;
        if (x < badgeColor.minX) badgeColor.minX = x;
        if (x > badgeColor.maxX) badgeColor.maxX = x;
        if (y < badgeColor.minY) badgeColor.minY = y;
        if (y > badgeColor.maxY) badgeColor.maxY = y;
      }
    }
  }

  return {
    gold: finalizeBlob(gold, width, height, pixels.width, pixels.height),
    red: finalizeBlob(red, width, height, pixels.width, pixels.height),
    blue: finalizeBlob(blue, width, height, pixels.width, pixels.height),
    badgeColor: finalizeBlob(badgeColor, width, height, pixels.width, pixels.height),
  };
}

function hasBadgeFrame(stats: ColorBlobStats | null): boolean {
  if (!stats) return false;

  return (
    stats.roiDensity >= 0.03 &&
    stats.blobWidthRatio >= 0.10 &&
    stats.blobWidthRatio <= 0.18 &&
    stats.blobHeightRatio >= 0.09 &&
    stats.blobHeightRatio <= 0.20
  );
}

function isSplitRedBlueSecondBadge(
  redStats: ColorBlobStats | null,
  blueStats: ColorBlobStats | null,
  badgeColorStats: ColorBlobStats | null,
): boolean {
  if (!redStats || !blueStats || !badgeColorStats) return false;

  return (
    badgeColorStats.roiDensity >= 0.12 &&
    badgeColorStats.roiDensity <= 0.25 &&
    badgeColorStats.blobWidthRatio >= 0.10 &&
    badgeColorStats.blobWidthRatio <= 0.15 &&
    badgeColorStats.blobHeightRatio >= 0.16 &&
    badgeColorStats.blobHeightRatio <= 0.20 &&
    redStats.roiDensity >= 0.03 &&
    redStats.blobDensity >= 0.25 &&
    redStats.blobWidthRatio >= 0.02 &&
    redStats.blobWidthRatio <= 0.05 &&
    redStats.blobHeightRatio >= 0.09 &&
    redStats.blobHeightRatio <= 0.13 &&
    blueStats.roiDensity >= 0.09 &&
    blueStats.roiDensity <= 0.14 &&
    blueStats.blobWidthRatio >= 0.09 &&
    blueStats.blobWidthRatio <= 0.13 &&
    blueStats.blobHeightRatio >= 0.16 &&
    blueStats.blobHeightRatio <= 0.20
  );
}

function hasWideRedNoise(stats: ColorBlobStats | null): boolean {
  if (!stats) return false;

  return stats.roiDensity >= 0.03 && stats.blobWidthRatio >= 0.14;
}

function isBlueBadge(
  blueStats: ColorBlobStats | null,
  redStats: ColorBlobStats | null,
): boolean {
  if (hasWideRedNoise(redStats)) return false;
  const stats = blueStats;
  if (!stats) return false;

  return (
    stats.roiDensity >= 0.10 &&
    stats.blobDensity >= 0.115 &&
    stats.blobWidthRatio >= 0.08 &&
    stats.blobWidthRatio <= 0.18 &&
    stats.blobHeightRatio >= 0.09 &&
    stats.blobHeightRatio <= 0.20
  );
}

function isRedBadge(stats: ColorBlobStats | null): boolean {
  if (!stats) return false;

  return (
    stats.roiDensity >= 0.03 &&
    stats.blobDensity >= 0.045 &&
    stats.blobWidthRatio >= 0.08 &&
    stats.blobWidthRatio <= 0.14 &&
    stats.blobHeightRatio >= 0.09 &&
    stats.blobHeightRatio <= 0.20
  );
}

export async function detectInDuelBadgeTurnOrderByImageFeatures(
  input: ImageLike,
): Promise<'first' | 'second' | null> {
  const pixels = await readImagePixels(input);
  if (!pixels) return null;

  const stats = getAllBadgeBlobStats(pixels);
  if (!stats) return null;

  if (!hasBadgeFrame(stats.gold)) {
    return isSplitRedBlueSecondBadge(stats.red, stats.blue, stats.badgeColor) ? 'second' : null;
  }

  if (isRedBadge(stats.red)) return 'second';

  if (isBlueBadge(stats.blue, stats.red)) return 'first';

  return null;
}
