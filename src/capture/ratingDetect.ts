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

// デュエルリザルト画面の判定: ">>" 演算子（旧レート → 新レートの矢印）が存在するか。
// Tesseract は "►" を "))" として出力する。
export function isResultScreenText(text: string): boolean {
  return /\){2,}/.test(text);
}

// レート戦ロビー画面の判定: "RATE" または関連キーワードが存在するか。
// Tesseract は "RATE" を "FATE", "rare", "TOP 50%" など様々な形で出力するため、
// "TOP" も判定基準に含める。
export function isLobbyScreenText(text: string): boolean {
  return /\bTOP\b/i.test(text) || /\bRATE\b|\bFATE\b/i.test(text);
}

// リザルト画面のレート変動表示: "旧レート - 変化量 )) 新レート"
// Tesseract が ">>" を "))" と出力するため、"))" 以降に現れた値のみを新レートとして返す。
// "))" の後ろに値がない（旧レートのみ表示）場合は null を返す。
function parseResultScreenNewRating(text: string): number | null {
  const arrowMatch = text.match(/\){2,}([\s\S]*)/);
  if (!arrowMatch) return null;
  return parseRatingFromText(collapseDigitSpaces(arrowMatch[1]));
}

function parseForLobbyScreen(text: string): number | null {
  // ロビー画面は小フォントでノイズが多いため、全前処理を適用
  const r1 = parseRatingFromText(restoreDecimalSeparator(text));
  if (r1 !== null) return r1;
  const r2 = parseRatingFromText(collapseDigitSpaces(text));
  if (r2 !== null) return r2;
  // "RATE: 1 B51 6.29" のように非数字文字が混入した場合:
  // RATE/FATE キーワード以降を抽出し、非数字・非小数点文字をスペースに置換してから再解析する。
  // 例: "1 B51 6.29" → "1  51 6.29" → collapseDigitSpaces → "1516.29"
  const kw = text.match(/(?:RATE|FATE)[:\s]+([0-9][^\n]*)/i);
  if (kw) {
    const raw = kw[1].split(/\s+TOP\s+/i)[0];
    const digits = raw.replace(/[^0-9. ]/g, ' ');
    const r3 = parseRatingFromText(collapseDigitSpaces(digits));
    if (r3 !== null) return r3;
  }
  return null;
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
  const recognize = (w: Worker) =>
    recognizeOpts ? w.recognize(ocrInput, recognizeOpts) : w.recognize(ocrInput);

  // パス1: PSM 6 — 大フォントのリザルト画面向け
  await worker.setParameters({ tessedit_pageseg_mode: '6' as PageSegmentationMode });
  const { data: d1 } = await recognize(worker);
  // リザルト画面: "))" の後ろに現れた値（新レート）のみを返す。
  // 旧レートのみ表示の遷移フレームでは null になる（誤検知防止）。
  if (isResultScreenText(d1.text)) {
    const r = parseResultScreenNewRating(d1.text);
    if (r !== null) return r;
  }

  // パス2: PSM 11 — PSM 6 でノイズが多い場合のフォールバック（ロビー画面含む）
  await worker.setParameters({ tessedit_pageseg_mode: '11' as PageSegmentationMode });
  const { data: d2 } = await recognize(worker);
  if (isResultScreenText(d2.text)) {
    const r = parseResultScreenNewRating(d2.text);
    if (r !== null) return r;
  }

  // パス3: ロビー画面専用の前処理（画面マーカーが確認できた場合のみ）
  // PSM 6/11 の直接解析では小フォント数値の認識精度が低いため、
  // 全前処理（スペース結合・カンマ変換・RATE キーワード抽出）を適用する。
  if (isLobbyScreenText(d1.text) || isLobbyScreenText(d2.text)) {
    const r3 = parseForLobbyScreen(d1.text);
    if (r3 !== null) return r3;
    return parseForLobbyScreen(d2.text);
  }

  return null;
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
