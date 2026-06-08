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
  isCoinTossWindowExpired,
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

  describe('isCoinTossWindowExpired', () => {
    it('まだコイントス未検出（null）なら経過時間に関係なく期限切れにしない', () => {
      // ロビー画面に長く留まっても最初のコイントスを取りこぼさない
      expect(isCoinTossWindowExpired(null, 60_000, 1_000_000)).toBe(false);
    });

    it('検出時刻から有効期限以内は期限切れにしない', () => {
      expect(isCoinTossWindowExpired(1000, 60_000, 1000 + 60_000)).toBe(false);
    });

    it('検出時刻から有効期限を超えたら期限切れにする', () => {
      expect(isCoinTossWindowExpired(1000, 60_000, 1000 + 60_001)).toBe(true);
    });
  });
});
