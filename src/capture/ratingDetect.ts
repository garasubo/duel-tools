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
  const matches = [...text.matchAll(/(?<!\d)([12]\d{3}\.\d+)(?!\d)/g)];
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

// 小フォントの小数部により小数点が欠落・スペース化する OCR アーティファクトを修正する。
// "1517 01" → "1517.01"、"1517 .01" → "1517.01"、"151701" → "1517.01" など。
function restoreDecimalSeparator(text: string): string {
  let result = text;
  // 小数点前後のスペース除去
  result = result.replace(/(\d) +(\.)/g, '$1$2');
  result = result.replace(/(\.) +(\d)/g, '$1$2');
  // カンマ区切りをピリオドに変換
  result = result.replace(/(?<!\d)([12]\d{3}),(\d{1,3})(?!\d)/g, '$1.$2');
  // スペースで代替された小数点を復元: "1517 01" → "1517.01"
  result = result.replace(/(?<!\d)([12]\d{3}) +(\d{1,3})(?!\d)/g, '$1.$2');
  // 小数点が完全に欠落している場合の復元: "151701" → "1517.01"
  // （小フォント小数部で小数点が文字認識されないケース）
  result = result.replace(/(?<!\d)([12]\d{3})(\d{1,3})(?!\d)/g, '$1.$2');
  return result;
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
  // パス1: PSM 6（テキストブロック）— デュエルリザルト画面・ロビー画面の多くをカバー
  await worker.setParameters({ tessedit_pageseg_mode: '6' as PageSegmentationMode });
  const { data: d1 } = recognizeOpts
    ? await worker.recognize(ocrInput, recognizeOpts)
    : await worker.recognize(ocrInput);
  // 小フォント小数点の修復を先に試みる（"1517 01" → "1517.01"）
  const r1a = parseRatingFromText(restoreDecimalSeparator(d1.text));
  if (r1a !== null) return r1a;
  // 数字間スペース除去（"1 51 7.77" → "1517.77"）
  const r1b = parseRatingFromText(collapseDigitSpaces(d1.text));
  if (r1b !== null) return r1b;

  // パス2: PSM 11（疎なテキスト）— PSM 6 が小数点をスペースに誤読するロビー画面向けフォールバック
  await worker.setParameters({ tessedit_pageseg_mode: '11' as PageSegmentationMode });
  const { data: d2 } = recognizeOpts
    ? await worker.recognize(ocrInput, recognizeOpts)
    : await worker.recognize(ocrInput);
  const r2a = parseRatingFromText(restoreDecimalSeparator(d2.text));
  if (r2a !== null) return r2a;
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
