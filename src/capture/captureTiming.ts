import type { DetectionResult } from './types';

export const NORMAL_OCR_INTERVAL_MS = 350;
export const FAST_OCR_INTERVAL_MS = 150;
export const REQUIRED_CONSECUTIVE = 3;
export const HIGH_CONFIDENCE_THRESHOLD = 85;
export const HIGH_CONFIDENCE_REQUIRED_CONSECUTIVE = 2;
// 画像特徴分類が確定的に返す信頼度（= ocrDetect.ts の IMAGE_FEATURE_CONFIDENCE）。
// この値は形状＋下部暗転オーバーレイの厳格ゲートを通った場合のみ得られるため、
// 1 フレームで結果を確定してよい（ユーザーが結果画面を素早く進めても取りこぼさない）。
export const SINGLE_FRAME_CONFIDENCE_THRESHOLD = 92;

export function getOcrInterval(hasCandidate: boolean): number {
  return hasCandidate ? FAST_OCR_INTERVAL_MS : NORMAL_OCR_INTERVAL_MS;
}

export function getRequiredConsecutive(confidence: number): number {
  if (confidence >= SINGLE_FRAME_CONFIDENCE_THRESHOLD) return 1;
  if (confidence >= HIGH_CONFIDENCE_THRESHOLD) return HIGH_CONFIDENCE_REQUIRED_CONSECUTIVE;
  return REQUIRED_CONSECUTIVE;
}

export function averageConfidence(results: DetectionResult[]): number {
  if (results.length === 0) return 0;
  return results.reduce((sum, item) => sum + item.confidence, 0) / results.length;
}

export function getElapsedMs(startedAt: number, now = Date.now()): number {
  return now - startedAt;
}

// コイントス検出の有効期限判定。
// 60秒のカウントは「最初のコイントス画面を検出した時刻」から始まる。
// firstSeenAt が null（まだ一度も検出していない）の間は期限切れにしない＝
// ロビー画面に長く留まってから試合を始めても最初のコイントスを取りこぼさない。
export function isCoinTossWindowExpired(
  firstSeenAt: number | null,
  durationMs: number,
  now = Date.now(),
): boolean {
  if (firstSeenAt === null) return false;
  return now - firstSeenAt > durationMs;
}
