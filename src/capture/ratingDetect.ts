import type { Worker } from 'tesseract.js';
import { buildOcrInput, roiToRectangle } from './ocrDetect';
import type { ROI } from './types';

// レーティング表示エリアのROI（デュエルリザルト画面・レート戦ロビー画面の両方をカバー）
export const RATING_ROI: ROI = {
  x: 0.05,
  y: 0.40,
  width: 0.90,
  height: 0.50,
};

const RATING_OCR_TARGET_WIDTH = 960;

// テキストから [1000, 2000] 範囲のレーティング値（小数可）を抽出する。
// 複数候補がある場合は最後の値を返す（デュエルリザルト画面で「旧レート >>> 新レート」の末尾が新レート）。
export function parseRatingFromText(text: string): number | null {
  const matches = [...text.matchAll(/(?<!\d)([12]\d{3}(?:\.\d+)?)(?!\d)/g)];
  if (matches.length === 0) return null;

  for (let i = matches.length - 1; i >= 0; i--) {
    const val = parseFloat(matches[i][1]);
    if (val > 1000 && val <= 2000) return val;
  }
  return null;
}

export async function detectRatingFromScreen(
  worker: Worker,
  canvas: HTMLCanvasElement,
  reusableCanvasRef?: { current: HTMLCanvasElement | null },
): Promise<number | null> {
  const rect = roiToRectangle(RATING_ROI, canvas.width, canvas.height);
  const built = buildOcrInput(
    canvas as unknown as Parameters<typeof buildOcrInput>[0],
    rect,
    reusableCanvasRef?.current ?? null,
    RATING_OCR_TARGET_WIDTH,
  );
  if (reusableCanvasRef) {
    reusableCanvasRef.current = built.reusableCanvas;
  }
  const { input: ocrInput, rectangle } = built.ocrInput;
  const { data } = rectangle
    ? await worker.recognize(ocrInput, { rectangle })
    : await worker.recognize(ocrInput);
  return parseRatingFromText(data.text);
}
