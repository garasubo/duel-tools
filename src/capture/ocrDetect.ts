import type { ImageLike } from 'tesseract.js';
import type { DetectionResult, ROI } from './types';

export function parseDetectionResult(
  text: string,
  confidence: number,
): DetectionResult | null {
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

/**
 * 2 パス OCR でテキストを認識する。
 * パス1: VICTORY ROI（中央帯）をデフォルト PSM でスキャン。
 * パス2: 全体を PSM 6（単一ブロック）でスキャン → LOSE を検出。
 */
export async function detectFromImageLike(
  input: ImageLike,
  imageWidth?: number,
  imageHeight?: number,
): Promise<DetectionResult | null> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');

  try {
    if (imageWidth && imageHeight) {
      const rect = {
        left: Math.floor(0.125 * imageWidth),
        top: Math.floor(0.30 * imageHeight),
        width: Math.floor(0.75 * imageWidth),
        height: Math.floor(0.32 * imageHeight),
      };
      // パス1: PSM 8（単一ワード）+ ROI — VICTORY のような 1 ワード大テキストに最適
      await worker.setParameters({ tessedit_pageseg_mode: '8' });
      const { data: d1 } = await worker.recognize(input, { rectangle: rect });
      const r1 = parseDetectionResult(d1.text, d1.confidence);
      if (r1) return r1;

      // パス2: PSM 7（単一行）+ ROI — ROI 内の LOSE 検出向け
      await worker.setParameters({ tessedit_pageseg_mode: '7' });
      const { data: d2 } = await worker.recognize(input, { rectangle: rect });
      const r2 = parseDetectionResult(d2.text, d2.confidence);
      if (r2) return r2;
    }

    // パス3: PSM 6（単一ブロック）+ 全画像 — ROI で検出できない LOSE 向けフォールバック
    await worker.setParameters({ tessedit_pageseg_mode: '6' });
    const { data: d3 } = await worker.recognize(input);
    return parseDetectionResult(d3.text, d3.confidence);
  } finally {
    await worker.terminate();
  }
}
