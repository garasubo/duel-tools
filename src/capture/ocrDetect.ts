import type { ImageLike, Worker } from 'tesseract.js';
import type { DetectionResult, ROI } from './types';

type PageSegmentationMode = Parameters<Worker['setParameters']>[0]['tessedit_pageseg_mode'];

const PSM_SINGLE_BLOCK = '6' as PageSegmentationMode;
const PSM_SINGLE_LINE = '7' as PageSegmentationMode;
const PSM_SINGLE_WORD = '8' as PageSegmentationMode;

export const MIN_RESULT_CONFIDENCE = 60;
const CLEAR_RESULT_TEXT_CONFIDENCE = 85;

function confidenceWithTextMatch(text: string, confidence: number): number {
  const upper = text.toUpperCase();
  if (/(^|[^A-Z0-9])VICTORY([^A-Z0-9]|$)/.test(upper)
    || /(^|[^A-Z0-9])LOSE([^A-Z0-9]|$)/.test(upper)) {
    return Math.max(confidence, CLEAR_RESULT_TEXT_CONFIDENCE);
  }
  return confidence;
}

export function parseDetectionResult(
  text: string,
  confidence: number,
): DetectionResult | null {
  if (confidence < MIN_RESULT_CONFIDENCE) return null;

  const upper = text.toUpperCase();
  if (upper.includes('VICTORY')) return { result: 'win', confidence };
  if (upper.includes('LOSE')) return { result: 'loss', confidence };
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
