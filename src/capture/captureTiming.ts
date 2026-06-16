import type { DetectionResult } from './types';

// フレームサンプリング目標 fps。安価な画像特徴ゲートをこの間隔で回し、一瞬の
// VICTORY/LOSE/コイントス画面を取りこぼさないようにする（OCR は候補時のみ）。
export const TARGET_CAPTURE_FPS = 30;
export const CAPTURE_SAMPLE_INTERVAL_MS = Math.round(1000 / TARGET_CAPTURE_FPS); // ≈33ms
// 旧名は同じサンプル間隔を指す（候補有無で差は付けない＝常に 30fps でサンプリングする）。
export const NORMAL_OCR_INTERVAL_MS = CAPTURE_SAMPLE_INTERVAL_MS;
export const FAST_OCR_INTERVAL_MS = CAPTURE_SAMPLE_INTERVAL_MS;
export const REQUIRED_CONSECUTIVE = 3;
export const HIGH_CONFIDENCE_THRESHOLD = 85;
export const HIGH_CONFIDENCE_REQUIRED_CONSECUTIVE = 2;
// 画像特徴分類が確定的に返す信頼度（= ocrDetect.ts の IMAGE_FEATURE_CONFIDENCE）。
// この値は形状＋下部暗転オーバーレイの厳格ゲートを通った場合のみ得られるため、
// 1 フレームで結果を確定してよい（ユーザーが結果画面を素早く進めても取りこぼさない）。
export const SINGLE_FRAME_CONFIDENCE_THRESHOLD = 92;
// 連続一致による確定に要求する最小経過時間（ms）。
// 連続「回数」だけだと 30fps では数十msで条件を満たし、演出の一瞬のフラッシュ（OCR/救済の
// 信頼度 85〜91 帯）を誤確定しやすい。サンプリング fps に依存しない確定にするため、
// 確定的一致（≥92, 1 フレーム即確定）以外は最低この時間継続することを併せて要求する。
export const MIN_CONFIRM_DURATION_MS = 250;

export function getOcrInterval(_hasCandidate: boolean): number {
  void _hasCandidate;
  return CAPTURE_SAMPLE_INTERVAL_MS;
}

// 指定 fps のフレームサンプリング間隔（ms）。判定頻度設定（useCaptureFpsSetting）から
// 結果判定ループの周期を決めるのに使う。CAPTURE_SAMPLE_INTERVAL_MS と同じ算出式。
export function getSampleIntervalForFps(fps: number): number {
  return Math.round(1000 / fps);
}

export function getRequiredConsecutive(confidence: number): number {
  if (confidence >= SINGLE_FRAME_CONFIDENCE_THRESHOLD) return 1;
  if (confidence >= HIGH_CONFIDENCE_THRESHOLD) return HIGH_CONFIDENCE_REQUIRED_CONSECUTIVE;
  return REQUIRED_CONSECUTIVE;
}

// 確定に要求する最小経過時間。確定的一致（≥92）は即確定のため 0。
export function getMinConfirmDurationMs(confidence: number): number {
  return confidence >= SINGLE_FRAME_CONFIDENCE_THRESHOLD ? 0 : MIN_CONFIRM_DURATION_MS;
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
