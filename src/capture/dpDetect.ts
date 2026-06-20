import type { ImageLike, Worker } from 'tesseract.js';
import { buildOcrInput, hasResultScreenText, roiToRectangle } from './ocrDetect';
import type { ROI } from './types';

type PageSegmentationMode = Parameters<Worker['setParameters']>[0]['tessedit_pageseg_mode'];

// DP（デュエルポイント）表示エリアの ROI。
// DCモードのデュエルリザルト画面（中央: "DP ▶ 旧 ±変化量 ▶ 新"）と
// ロビー/エリア代表決定戦画面（左中央: "DP ▶ 現在値"）の両方をカバーする広めの帯。
export const DP_ROI: ROI = {
  x: 0.05,
  y: 0.4,
  width: 0.9,
  height: 0.5,
};

const DP_OCR_TARGET_WIDTH = 960;

// フォールバックパス用の数字＋矢印記号ホワイトリスト。
// "DP" ラベルは捨てるが、▶▶ 由来の "))"/">>" は残して矢印アンカーを効かせる。
// "+"/"-" も残し、ホワイトリストパスでも変化量（"+1000" 等）を読んで
// validatedTransition で 旧±変化量==新 を検証できるようにする。
const DP_WHITELIST = '0123456789)>+-';

// DP の妥当範囲。2桁以下のノイズ（"勝利数 2" など）を除外しつつ、
// 大会後半の高 DP（数万）まで拾えるよう上限は広めに取る。
const DP_MIN = 100;
const DP_MAX = 999999;

function isInDpRange(value: number): boolean {
  return Number.isInteger(value) && value >= DP_MIN && value <= DP_MAX;
}

// OCR がロビー/リザルト画面の千区切りスペースを挿入することがある（例: "1 859"）。
// 「1〜3桁 + (空白 + 3桁)+」の千区切りパターンのみ連結してパース精度を上げる。
// "5735 0"（4桁+1桁）のような桁区切りでない隣接ノイズは連結しない
// （数値の右側にある装飾アイコンを "0" と誤読したものが本来値に合体するのを防ぐ）。
export function collapseDigitSpaces(text: string): string {
  return text.replace(/\d{1,3}(?: +\d{3})+/g, (m) => m.replace(/ +/g, ''));
}

// テキストから DP 妥当範囲（3〜6桁）の整数を出現順に列挙する。
function dpMatches(text: string): number[] {
  return [...text.matchAll(/(?<!\d)(\d{3,6})(?!\d)/g)]
    .map((m) => parseInt(m[1], 10))
    .filter(isInDpRange);
}

function firstDpInRange(text: string): number | null {
  const all = dpMatches(text);
  return all.length > 0 ? all[0] : null;
}

// 矢印（▶ → Tesseract 出力 "))"/">>"。ロビー画面では単一の ")"/">" に劣化することもある）の
// 直後にある妥当整数を返す。最後に出現したものを採用する（リザルト画面では新DPが末尾、
// ロビー画面では矢印が1つ）。矢印と数字の間は空白のみ許容し、離れた位置のノイズ
// （ロゴの "2026" 等）を拾わないようにする。
export function dpAfterArrow(text: string): number | null {
  const all = [...text.matchAll(/[)>]+\s*(\d{3,6})(?!\d)/g)]
    .map((m) => parseInt(m[1], 10))
    .filter(isInDpRange);
  return all.length > 0 ? all[all.length - 1] : null;
}

// リザルト画面の判定: 矢印（▶ → Tesseract 出力 "))" / ">>"）が 2 群以上。
// 旧DP → 新DP の遷移表示があるのはリザルト画面のみ。
export function isDpResultScreenText(text: string): boolean {
  return (text.match(/[)>]{2,}/g) ?? []).length >= 2;
}

// DP 画面の判定: 矢印 "))"/">>" か "DP" ラベル（"D0" 誤読も許容）が存在するか。
export function isDpScreenText(text: string): boolean {
  return /[)>]{2,}/.test(text) || /\bD[P0]\b/i.test(text);
}

// 汎用 DP 抽出。矢印（▶ → "))"/">>"）があれば最後の矢印以降の最初の整数を新DPとして返す。
// 矢印が無い場合は、妥当整数がちょうど 1 つのときのみ採用（複数は曖昧として null）。
export function parseDpFromText(text: string): number | null {
  const collapsed = collapseDigitSpaces(text);
  const afterArrow = dpAfterArrow(collapsed);
  if (afterArrow !== null) return afterArrow;
  const all = dpMatches(collapsed);
  return all.length === 1 ? all[0] : null;
}

// "旧 ± 変化量 … 新" の遷移を矢印に依存せず検出する。旧 ± 変化量 == 新 のときだけ新DPを返す。
// Tesseract が ▶▶ を ")»" 等に化けさせ二重矢印分割（parseDpResultScreen）が壊れても新DPを拾える。
// 変化量と新DPの間は非数字 8 文字までの隙間（" )) " / ")» " 等の矢印ノイズ）を許容する。
// 算術一致を必須にすることで、ロビー/ノイズ画面での誤検出を防ぐ。
export function validatedTransition(text: string): number | null {
  for (const m of text.matchAll(/(\d{3,6})\s*([+−–—-])\s*(\d{1,6})\D{0,8}?(\d{3,6})/g)) {
    const oldDp = parseInt(m[1], 10);
    const delta = parseInt(m[3], 10);
    const newDp = parseInt(m[4], 10);
    const sign = m[2] === '+' ? 1 : -1;
    if (isInDpRange(oldDp) && isInDpRange(newDp) && oldDp + sign * delta === newDp) {
      return newDp;
    }
  }
  return null;
}

// リザルト画面（0098 系）の解析: "DP ▶ 旧 ±変化量 ▶ 新" から新DPを返す。
// 旧DPと変化量（DP は整数）が両方読めた場合は 旧 ± 変化量 == 新 を検証し、
// フォントによる 1 桁誤読での誤確定を防ぐ:
//   - 新 が読めて一致 → 新 を返す
//   - 新 が読めるが不一致 → null（曖昧フレーム。次フレーム待ち）
// 旧/変化量が読めない場合は「最後の矢印以降の整数」にフォールバックする。
export function parseDpResultScreen(text: string): number | null {
  const collapsed = collapseDigitSpaces(text);
  const lastArrow = collapsed.match(/^([\s\S]*)[)>]{2,}([\s\S]*?)$/);
  if (!lastArrow) return null;
  const [, left, right] = lastArrow;
  const newDp = firstDpInRange(right);

  // 旧DP ± 変化量（"-" は em/en ダッシュ等の誤読も許容。範囲指定回避で末尾に置く）。
  const deltaMatch = left.match(/(?<!\d)(\d{3,6})\s*([+−–—-])\s*(\d{1,6})(?!\d)/);
  if (deltaMatch) {
    const oldDp = parseInt(deltaMatch[1], 10);
    const delta = parseInt(deltaMatch[3], 10);
    const sign = deltaMatch[2] === '+' ? 1 : -1;
    const computed = oldDp + sign * delta;
    if (isInDpRange(oldDp) && isInDpRange(computed)) {
      return newDp !== null && newDp === computed ? newDp : null;
    }
  }
  return newDp;
}

// ロビー/エリア代表決定戦画面（0099 系）の解析: "DP ▶ 現在値" から DP を返す。
// 矢印アンカー → "DP" キーワードアンカー → 単一整数 の順に試す。
export function parseDpLobbyScreen(text: string): number | null {
  const collapsed = collapseDigitSpaces(text);
  const afterArrow = dpAfterArrow(collapsed);
  if (afterArrow !== null) return afterArrow;
  const kw = collapsed.match(/D[P0][)>:\s]*([\s\S]*)$/i);
  if (kw) {
    const v = firstDpInRange(kw[1]);
    if (v !== null) return v;
  }
  const all = dpMatches(collapsed);
  return all.length === 1 ? all[0] : null;
}

export async function createDpOcrWorker(): Promise<Worker> {
  const { createWorker } = await import('tesseract.js');
  return createWorker('eng');
}

async function runDpOcr(
  worker: Worker,
  ocrInput: ImageLike,
  recognizeOpts: { rectangle?: { left: number; top: number; width: number; height: number } } | undefined,
): Promise<number | null> {
  const recognize = (w: Worker) =>
    recognizeOpts ? w.recognize(ocrInput, recognizeOpts) : w.recognize(ocrInput);

  // 各パスから「確定 DP（validatedTransition → 二重矢印リザルト解析）」を試みる。
  // どちらも矢印アンカー付き・算術検証済みなので、盤面 ATK 値などの裸整数を拾わない。
  const confirmedDp = (text: string): number | null => {
    const v = validatedTransition(collapseDigitSpaces(text));
    if (v !== null) return v;
    return isDpResultScreenText(text) ? parseDpResultScreen(text) : null;
  };

  // パス1: PSM 6 — 大フォントのリザルト画面向け。ホワイトリストは無効化し、
  // "DP"/"))" などの画面判定マーカーも読めるようにする。
  await worker.setParameters({
    tessedit_pageseg_mode: '6' as PageSegmentationMode,
    tessedit_char_whitelist: '',
  });
  const { data: d1 } = await recognize(worker);
  const c1 = confirmedDp(d1.text);
  if (c1 !== null) return c1;

  // パス2: PSM 11 — PSM 6 でノイズが多い場合のフォールバック（ロビー画面含む）。
  await worker.setParameters({ tessedit_pageseg_mode: '11' as PageSegmentationMode });
  const { data: d2 } = await recognize(worker);
  const c2 = confirmedDp(d2.text);
  if (c2 !== null) return c2;

  // 確定遷移が取れなかった段階で画面種別を判定する。
  // 結果画面（VICTORY/LOSE）なら遷移アニメ途中の可能性が高く、旧DP単独の矢印値を
  // 確定してしまうと誤った旧DPを記録するため、ここでは確定せず null（次フレーム待ち）。
  // ロビー画面なら現在DPの単独表示が正なので、矢印アンカー値を採用する。
  const isResultScreen = hasResultScreenText(d1.text) || hasResultScreenText(d2.text);

  // ロビー/単一矢印画面では PSM 6 が末尾を 1 桁誤読することがあるため、PSM 11 を優先する。
  if (!isResultScreen) {
    const a2 = dpAfterArrow(collapseDigitSpaces(d2.text));
    if (a2 !== null) return a2;
  }

  // パス3: 数字＋矢印記号ホワイトリスト + PSM 11 の最終手段。
  // 小フォントの数字認識を安定させる（"DP" は消えるが矢印・符号アンカーは残す）。
  await worker.setParameters({
    tessedit_pageseg_mode: '11' as PageSegmentationMode,
    tessedit_char_whitelist: DP_WHITELIST,
  });
  const { data: d3 } = await recognize(worker);
  const v3 = validatedTransition(collapseDigitSpaces(d3.text));
  if (v3 !== null) return v3;
  if (!isResultScreen) {
    const a3 = dpAfterArrow(collapseDigitSpaces(d3.text));
    if (a3 !== null) return a3;
    const a1 = dpAfterArrow(collapseDigitSpaces(d1.text));
    if (a1 !== null) return a1;
  }

  return null;
}

export async function detectDpFromImageLike(
  worker: Worker,
  input: ImageLike,
  imageWidth: number,
  imageHeight: number,
): Promise<number | null> {
  const rect = roiToRectangle(DP_ROI, imageWidth, imageHeight);
  const built = buildOcrInput(
    input as unknown as Parameters<typeof buildOcrInput>[0],
    rect,
    null,
    DP_OCR_TARGET_WIDTH,
  );
  const { input: ocrInput, rectangle } = built.ocrInput;
  return runDpOcr(worker, ocrInput, rectangle ? { rectangle } : undefined);
}

export async function detectDpFromScreen(
  worker: Worker,
  canvas: HTMLCanvasElement,
  reusableCanvasRef?: { current: HTMLCanvasElement | null },
): Promise<number | null> {
  const rect = roiToRectangle(DP_ROI, canvas.width, canvas.height);
  const built = buildOcrInput(
    canvas as unknown as Parameters<typeof buildOcrInput>[0],
    rect,
    reusableCanvasRef?.current ?? null,
    DP_OCR_TARGET_WIDTH,
  );
  if (reusableCanvasRef) {
    reusableCanvasRef.current = built.reusableCanvas;
  }
  const { input: ocrInput, rectangle } = built.ocrInput;
  return runDpOcr(worker, ocrInput, rectangle ? { rectangle } : undefined);
}
