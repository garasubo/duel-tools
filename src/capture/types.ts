export interface ROI {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type DuelCaptureState = 'idle' | 'capturing' | 'detected' | 'waiting-clear';

export interface DetectionResult {
  result: 'win' | 'loss';
  confidence: number;
}

// Master Duel 結果画面のデフォルトROI（VICTORY テキストが出る中央帯）
export const DEFAULT_RESULT_ROI: ROI = {
  x: 0.125,
  y: 0.30,
  width: 0.75,
  height: 0.32,
};
