import type { ImageLike, Worker } from 'tesseract.js';
import { buildOcrInput, roiToRectangle } from './ocrDetect';
import type { ROI } from './types';

type PageSegmentationMode = Parameters<Worker['setParameters']>[0]['tessedit_pageseg_mode'];

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

// OCR がロビー画面の数値間にスペースを挿入することがある（例: "1 51 7.77"）。
// 数字-スペース-数字 のパターンを連結してパース精度を上げる。
function collapseDigitSpaces(text: string): string {
  return text.replace(/(\d) +(\d)/g, '$1$2');
}

export async function createRatingOcrWorker(): Promise<Worker> {
  const { createWorker } = await import('tesseract.js');
  return createWorker('eng');
}

async function runRatingOcr(
  worker: Worker,
  ocrInput: ImageLike,
  recognizeOpts: { rectangle?: { left: number; top: number; width: number; height: number } } | undefined,
): Promise<number | null> {
  // パス1: PSM 6（テキストブロック）+ 数字間スペース除去 — デュエルリザルト画面・ロビー画面の多くをカバー
  await worker.setParameters({ tessedit_pageseg_mode: '6' as PageSegmentationMode });
  const { data: d1 } = recognizeOpts
    ? await worker.recognize(ocrInput, recognizeOpts)
    : await worker.recognize(ocrInput);
  const r1 = parseRatingFromText(collapseDigitSpaces(d1.text));
  if (r1 !== null) return r1;

  // パス2: PSM 11（疎なテキスト）— PSM 6 が小数点をスペースに誤読するロビー画面向けフォールバック
  await worker.setParameters({ tessedit_pageseg_mode: '11' as PageSegmentationMode });
  const { data: d2 } = recognizeOpts
    ? await worker.recognize(ocrInput, recognizeOpts)
    : await worker.recognize(ocrInput);
  return parseRatingFromText(d2.text);
}

export async function detectRatingFromImageLike(
  worker: Worker,
  input: ImageLike,
  imageWidth: number,
  imageHeight: number,
): Promise<number | null> {
  const rect = roiToRectangle(RATING_ROI, imageWidth, imageHeight);
  const built = buildOcrInput(
    input as unknown as Parameters<typeof buildOcrInput>[0],
    rect,
    null,
    RATING_OCR_TARGET_WIDTH,
  );
  const { input: ocrInput, rectangle } = built.ocrInput;
  return runRatingOcr(worker, ocrInput, rectangle ? { rectangle } : undefined);
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
  return runRatingOcr(worker, ocrInput, rectangle ? { rectangle } : undefined);
}
