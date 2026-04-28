import type { ImageLike, Worker } from 'tesseract.js';
import type { ROI } from './types';

export type CoinTossScreen =
  | 'user-selecting'      // coin_win_001: 「先攻・後攻を選択してください」
  | 'opponent-selecting'  // coin_lose_001: 「対戦相手が先攻・後攻を選択しています」
  | 'you-are-first'       // coin_win_002: 「あなたが先攻です。」
  | 'you-are-second';     // coin_lose_002: 「あなたが後攻です。」

export const COIN_TOSS_TEXT_ROI: ROI = {
  x: 0.15,
  y: 0.38,
  width: 0.70,
  height: 0.28,
};

// Tesseract.js は日本語テキストを認識する際に単語間にスペースを挿入することがある。
// スペースを除去してから判定する。
function normalizeOcrText(text: string): string {
  return text.replace(/\s+/g, '');
}

export function parseCoinTossText(text: string): CoinTossScreen | null {
  const normalized = normalizeOcrText(text);
  // 「選択してください」→ ユーザーが先攻/後攻を選択する画面（コイントス勝ち）
  if (normalized.includes('選択してください')) return 'user-selecting';
  // 「対戦相手」→ 相手が選択中（コイントス負け）
  if (normalized.includes('対戦相手') && normalized.includes('選択')) return 'opponent-selecting';
  // 「先攻で」→ あなたが先攻（「先攻です。」の「す」がOCRで欠落する場合も対応）
  if (normalized.includes('先攻で')) return 'you-are-first';
  // 「後攻で」→ あなたが後攻
  if (normalized.includes('後攻で')) return 'you-are-second';
  return null;
}

export async function createJpnOcrWorker(): Promise<Worker> {
  const { createWorker } = await import('tesseract.js');
  return createWorker('jpn');
}

export async function detectCoinTossScreen(
  worker: Worker,
  input: ImageLike,
): Promise<CoinTossScreen | null> {
  // フル画像スキャン: ROIより精度が高い（コンテキストが多いほど認識精度が上がる）
  const { data } = await worker.recognize(input);
  return parseCoinTossText(data.text);
}

// デュエル中のターン番号を英語OCRテキストから解析する（フォールバック用）
const IN_DUEL_BADGE_ROI: ROI = {
  x: 0.62,
  y: 0.52,
  width: 0.30,
  height: 0.18,
};

export { IN_DUEL_BADGE_ROI };

export function parseInDuelTurnOrder(badgeText: string): 'first' | 'second' | null {
  const upper = badgeText.toUpperCase();
  if (!upper.includes('MAIN')) return null;
  if (/\bTURN\s*2\b/.test(upper)) return 'second';
  if (/\bTURN\s*1\b/.test(upper)) return 'first';
  return null;
}
