import type { ImageLike, Worker } from 'tesseract.js';
import type { ROI } from './types';
import { readImagePixels, roiToRectangle } from './ocrDetect';

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
  x: 0.05,
  y: 0.45,
  width: 0.90,
  height: 0.33,
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
  if (normalized.includes('選択してください')) return 'user-selecting';
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

export async function detectCoinTossScreen(
  worker: Worker,
  input: ImageLike,
  imageWidth?: number,
  imageHeight?: number,
): Promise<CoinTossScreen | null> {
  if (imageWidth && imageHeight) {
    const rois =
      imageWidth >= 1500
        ? [COIN_TOSS_WIDE_TEXT_ROI]
        : [COIN_TOSS_TEXT_ROI, COIN_TOSS_FALLBACK_TEXT_ROI, COIN_TOSS_HIGH_TEXT_ROI];

    for (const roi of rois) {
      const rect = {
        left: Math.floor(roi.x * imageWidth),
        top: Math.floor(roi.y * imageHeight),
        width: Math.floor(roi.width * imageWidth),
        height: Math.floor(roi.height * imageHeight),
      };
      const { data } = await worker.recognize(input, { rectangle: rect });
      const result = parseCoinTossText(data.text);
      if (result) return result;
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

function isBlueBadgePixel(data: Uint8ClampedArray | Uint8Array, offset: number): boolean {
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const a = data[offset + 3];
  if (a < 180) return false;

  return b >= 100 && b > r * 1.25 && b > g * 1.05;
}

function isRedBadgePixel(data: Uint8ClampedArray | Uint8Array, offset: number): boolean {
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const a = data[offset + 3];
  if (a < 180) return false;

  return r >= 95 && r > g * 1.35 && r > b * 1.15;
}

function isGoldBadgePixel(data: Uint8ClampedArray | Uint8Array, offset: number): boolean {
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const a = data[offset + 3];
  if (a < 180) return false;

  return r >= 120 && g >= 80 && r > b * 1.25 && g > b * 1.05;
}

interface ColorBlobStats {
  roiDensity: number;
  blobDensity: number;
  blobWidthRatio: number;
  blobHeightRatio: number;
}

function getColorBlobStats(
  pixels: Awaited<ReturnType<typeof readImagePixels>>,
  predicate: (data: Uint8ClampedArray | Uint8Array, offset: number) => boolean,
): ColorBlobStats | null {
  if (!pixels) return null;

  const rect = roiToRectangle(IN_DUEL_BADGE_FEATURE_ROI, pixels.width, pixels.height);
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(pixels.width, rect.left + rect.width);
  const bottom = Math.min(pixels.height, rect.top + rect.height);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return null;

  let count = 0;
  let minX = right;
  let minY = bottom;
  let maxX = left - 1;
  let maxY = top - 1;

  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const offset = (y * pixels.width + x) * 4;
      if (!predicate(pixels.data, offset)) continue;
      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return null;

  const roiDensity = count / (width * height);
  const blobWidthRatio = (maxX - minX + 1) / pixels.width;
  const blobHeightRatio = (maxY - minY + 1) / pixels.height;
  const blobArea = (maxX - minX + 1) * (maxY - minY + 1);
  const blobDensity = count / blobArea;

  return { roiDensity, blobDensity, blobWidthRatio, blobHeightRatio };
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

function isBlueBadge(stats: ColorBlobStats | null): boolean {
  if (!stats) return false;

  return (
    stats.roiDensity >= 0.10 &&
    stats.blobDensity >= 0.12 &&
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
    stats.blobWidthRatio <= 0.18 &&
    stats.blobHeightRatio >= 0.09 &&
    stats.blobHeightRatio <= 0.20
  );
}

export async function detectInDuelBadgeTurnOrderByImageFeatures(
  input: ImageLike,
): Promise<'first' | 'second' | null> {
  const pixels = await readImagePixels(input);
  if (!pixels) return null;

  const goldStats = getColorBlobStats(pixels, isGoldBadgePixel);
  if (!hasBadgeFrame(goldStats)) return null;

  const redStats = getColorBlobStats(pixels, isRedBadgePixel);
  if (isRedBadge(redStats)) return 'second';

  const blueStats = getColorBlobStats(pixels, isBlueBadgePixel);
  if (isBlueBadge(blueStats)) return 'first';

  return null;
}
