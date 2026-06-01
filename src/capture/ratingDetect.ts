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

// レート戦で使う数字ホワイトリスト（小数点含む）。ロビー画面の装飾フォントは
// 英字ノイズ（B/I/RATE など）が混入しやすいため、フォールバックパスで
// Tesseract の出力を数字・小数点だけに制限して認識を安定させる。
const RATING_WHITELIST = '0123456789.';

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

// スペースで分断された数字を連結してから小数点を復元する複合正規化。
// 例: "1 601 .76" → collapse → "1601 .76" → restore → "1601.76"
// collapse 単独・restore 単独では拾えない「数字分断 + 小数点スペース化」の
// 合わせ技ケースを救済する。
function normalizeSpacedRating(text: string): string {
  return restoreDecimalSeparator(collapseDigitSpaces(text));
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

// 数字トークンをレート値（小数2桁）に復元する。
// "1508.94" → 1508.94 / "153965" → 1539.65（小数点欠落）/ "151701" → 1517.01
export function reconstructRate(token: string): number | null {
  const t = token.replace(/[^0-9.]/g, '');
  if (/^[12]\d{3}\.\d{1,2}$/.test(t)) return parseFloat(t);
  if (/^[12]\d{5}$/.test(t)) return parseFloat(`${t.slice(0, 4)}.${t.slice(4)}`);
  return null;
}

// 変化量トークンを復元する。変化量は常に小数2桁で表示される。
// "8.04" → 8.04 / "751" → 7.51 / "835" → 8.35
export function reconstructDelta(token: string): number | null {
  const t = token.replace(/[^0-9.]/g, '');
  if (/^\d{1,2}\.\d{1,2}$/.test(t)) return parseFloat(t);
  if (/^\d{3,4}$/.test(t)) return parseFloat(`${t.slice(0, -2)}.${t.slice(-2)}`);
  return null;
}

// リザルト画面のレート変動表示 "旧レート ± 変化量 )) 新レート" を解析する。
// Tesseract は ">>" を "))" と出力する。
//
// 旧レートと変化量が両方読めた場合は new == 旧 ± 変化量 を検証し、
// 独特のフォントによる 1 桁誤読（6↔5 など）を吸収する:
//   - new が読めて一致     → new を返す（高信頼）
//   - new が読めるが不一致 → このフレームは曖昧とみなし null（次フレーム待ち。
//                            誤った値の確定を防ぐ。リザルト画面は表示が続くため
//                            自己整合するフレームで確定できる）
//   - new が読めない       → null（"旧レートのみ表示" の遷移フレームと区別できないため、
//                            旧 ± 変化量 からの値の捏造はしない）
// 旧レート/変化量が読めない場合は従来通り "))" 以降の値を返す。
export function parseResultScreenRating(text: string): number | null {
  const collapsed = collapseDigitSpaces(text);
  const arrowMatch = collapsed.match(/^([\s\S]*?)\){2,}([\s\S]*)$/);
  if (!arrowMatch) return null;
  const [, left, right] = arrowMatch;

  const newRate = parseRatingFromText(right);

  // 旧レート ± 変化量（"-" は em/en ダッシュ等の誤読も許容）。
  // 文字クラス内で範囲指定にならないよう "-" は末尾に置く。
  const deltaMatch = left.match(/([12][\d.]{3,6})\s*([+−–—-])\s*(\d[\d.]*)/);
  if (deltaMatch) {
    const oldRate = reconstructRate(deltaMatch[1]);
    const delta = reconstructDelta(deltaMatch[3]);
    if (oldRate !== null && delta !== null) {
      const sign = deltaMatch[2] === '+' ? 1 : -1;
      const computed = Math.round((oldRate + sign * delta) * 100) / 100;
      if (computed > 1000 && computed <= 2000) {
        // 旧 ± 変化量 と矛盾しない new のみ採用。new 不在や不一致は null。
        return newRate !== null && Math.abs(newRate - computed) < 0.01 ? newRate : null;
      }
    }
  }
  return newRate;
}

export function parseForLobbyScreen(text: string): number | null {
  // ロビー画面は小フォントでノイズが多いため、複数の正規化を順に試す。
  // normalizeSpacedRating は "1 601 .76"（数字分断 + 小数点スペース化）を救済する。
  const candidates = [
    restoreDecimalSeparator(text),
    collapseDigitSpaces(text),
    normalizeSpacedRating(text),
  ];
  for (const candidate of candidates) {
    const r = parseRatingFromText(candidate);
    if (r !== null) return r;
  }
  // "RATE: 1 B51 6.29" のように非数字文字が混入した場合:
  // RATE/FATE キーワード以降を抽出し、非数字・非小数点文字をスペースに置換してから再解析する。
  // 例: "1 B51 6.29" → "1  51 6.29" → normalizeSpacedRating → "1516.29"
  const kw = text.match(/(?:RATE|FATE)[:\s]+([0-9][^\n]*)/i);
  if (kw) {
    const raw = kw[1].split(/\s+TOP\s+/i)[0];
    const digits = raw.replace(/[^0-9. ]/g, ' ');
    const r = parseRatingFromText(normalizeSpacedRating(digits));
    if (r !== null) return r;
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

  // パス1: PSM 6 — 大フォントのリザルト画面向け。
  // ホワイトリストは無効化し、RATE/TOP/">>" などの画面判定キーワードも読めるようにする。
  await worker.setParameters({
    tessedit_pageseg_mode: '6' as PageSegmentationMode,
    tessedit_char_whitelist: '',
  });
  const { data: d1 } = await recognize(worker);
  // リザルト画面: "旧 ± 変化量 )) 新" を解析し、旧 ± 変化量 で新レートを検証する。
  // 旧レートのみ表示の遷移フレーム・検証不一致フレームでは null になる（誤確定防止）。
  if (isResultScreenText(d1.text)) {
    const r = parseResultScreenRating(d1.text);
    if (r !== null) return r;
  }

  // パス2: PSM 11 — PSM 6 でノイズが多い場合のフォールバック（ロビー画面含む）
  await worker.setParameters({ tessedit_pageseg_mode: '11' as PageSegmentationMode });
  const { data: d2 } = await recognize(worker);
  if (isResultScreenText(d2.text)) {
    const r = parseResultScreenRating(d2.text);
    if (r !== null) return r;
  }

  // パス3: ロビー画面専用の前処理（画面マーカーが確認できた場合のみ）
  // PSM 6/11 の直接解析では小フォント数値の認識精度が低いため、
  // 全前処理（スペース結合・カンマ変換・小数点復元・RATE キーワード抽出）を適用する。
  if (isLobbyScreenText(d1.text) || isLobbyScreenText(d2.text)) {
    const r3 = parseForLobbyScreen(d1.text);
    if (r3 !== null) return r3;
    const r4 = parseForLobbyScreen(d2.text);
    if (r4 !== null) return r4;

    // パス4: 数字ホワイトリスト + PSM 11 のフォールバック。
    // ロビーの装飾フォントは英字ノイズ（B/I/RATE 等）で数字が分断されやすい。
    // 出力を数字・小数点に制限すると分離が安定する。ただしキーワードが消えて
    // 画面判定ができなくなるため、ロビー確定後の最終手段としてのみ実行する。
    await worker.setParameters({
      tessedit_pageseg_mode: '11' as PageSegmentationMode,
      tessedit_char_whitelist: RATING_WHITELIST,
    });
    const { data: d5 } = await recognize(worker);
    const r5 = parseForLobbyScreen(d5.text);
    if (r5 !== null) return r5;
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
