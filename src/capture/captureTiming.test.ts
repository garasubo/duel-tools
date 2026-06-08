import { describe, expect, it } from 'vitest';
import {
  FAST_OCR_INTERVAL_MS,
  HIGH_CONFIDENCE_REQUIRED_CONSECUTIVE,
  NORMAL_OCR_INTERVAL_MS,
  REQUIRED_CONSECUTIVE,
  SINGLE_FRAME_CONFIDENCE_THRESHOLD,
  averageConfidence,
  getElapsedMs,
  getOcrInterval,
  getRequiredConsecutive,
} from './captureTiming';

describe('captureTiming', () => {
  it('候補検出後は OCR 間隔を短くする', () => {
    expect(getOcrInterval(false)).toBe(NORMAL_OCR_INTERVAL_MS);
    expect(getOcrInterval(true)).toBe(FAST_OCR_INTERVAL_MS);
  });

  it('高信頼度の候補は少ない連続確認回数で確定できる', () => {
    expect(getRequiredConsecutive(84)).toBe(REQUIRED_CONSECUTIVE);
    expect(getRequiredConsecutive(85)).toBe(HIGH_CONFIDENCE_REQUIRED_CONSECUTIVE);
    expect(getRequiredConsecutive(91)).toBe(HIGH_CONFIDENCE_REQUIRED_CONSECUTIVE);
  });

  it('画像特徴の確定的一致（信頼度92以上）は1フレームで確定できる', () => {
    expect(getRequiredConsecutive(SINGLE_FRAME_CONFIDENCE_THRESHOLD)).toBe(1);
    expect(getRequiredConsecutive(99)).toBe(1);
  });

  it('検出結果の平均信頼度を計算する', () => {
    expect(averageConfidence([])).toBe(0);
    expect(averageConfidence([
      { result: 'win', confidence: 90 },
      { result: 'win', confidence: 80 },
    ])).toBe(85);
  });

  it('開始時刻からの経過時間を計算する', () => {
    expect(getElapsedMs(1000, 1750)).toBe(750);
  });
});
