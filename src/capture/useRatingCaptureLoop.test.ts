import { describe, expect, it } from 'vitest';
import {
  advanceRatingStreak,
  EMPTY_RATING_STREAK,
  getNextScoreOcrDelay,
  SCORE_OCR_INTERVAL_MS,
  shouldRunScoreOcr,
} from './useRatingCaptureLoop';

describe('advanceRatingStreak', () => {
  it('同じレートを3回連続検出したときだけ確定する', () => {
    let update = advanceRatingStreak(EMPTY_RATING_STREAK, 1501.43);
    expect(update.confirmedRating).toBeNull();

    update = advanceRatingStreak(update.nextStreak, 1501.43);
    expect(update.confirmedRating).toBeNull();

    update = advanceRatingStreak(update.nextStreak, 1501.43);
    expect(update.confirmedRating).toBe(1501.43);
  });

  it('確定済みの同じレートは再通知しない', () => {
    let update = advanceRatingStreak(EMPTY_RATING_STREAK, 1501.43);
    update = advanceRatingStreak(update.nextStreak, 1501.43);
    update = advanceRatingStreak(update.nextStreak, 1501.43);
    expect(update.confirmedRating).toBe(1501.43);

    update = advanceRatingStreak(update.nextStreak, 1501.43);
    expect(update.confirmedRating).toBeNull();
  });

  it('別のレートを3回連続検出したら新しい値を確定する', () => {
    let update = advanceRatingStreak(EMPTY_RATING_STREAK, 1501.43);
    update = advanceRatingStreak(update.nextStreak, 1501.43);
    update = advanceRatingStreak(update.nextStreak, 1501.43);

    update = advanceRatingStreak(update.nextStreak, 1502.1);
    update = advanceRatingStreak(update.nextStreak, 1502.1);
    update = advanceRatingStreak(update.nextStreak, 1502.1);

    expect(update.confirmedRating).toBe(1502.1);
  });

  it('未検出フレームで連続検出状態をリセットする', () => {
    let update = advanceRatingStreak(EMPTY_RATING_STREAK, 1501.43);
    update = advanceRatingStreak(update.nextStreak, 1501.43);
    update = advanceRatingStreak(update.nextStreak, null);
    expect(update.nextStreak).toEqual(EMPTY_RATING_STREAK);

    update = advanceRatingStreak(update.nextStreak, 1501.43);
    expect(update.confirmedRating).toBeNull();
  });
});

describe('shouldRunScoreOcr', () => {
  it('フレーム取得関数がない場合は従来通り OCR を実行する', () => {
    expect(shouldRunScoreOcr()).toBe(true);
  });

  it('最新フレームを取得できた場合は OCR を実行する', () => {
    expect(shouldRunScoreOcr(() => true)).toBe(true);
  });

  it('最新フレームを取得できない場合は OCR を実行しない', () => {
    expect(shouldRunScoreOcr(() => false)).toBe(false);
  });
});

describe('getNextScoreOcrDelay', () => {
  it('初回予約はスコアOCR専用 interval をそのまま使う', () => {
    expect(getNextScoreOcrDelay()).toBe(SCORE_OCR_INTERVAL_MS);
  });

  it('処理時間を interval から差し引いて次回を予約する', () => {
    expect(getNextScoreOcrDelay(1000, 100, 867.3)).toBeCloseTo(232.7);
  });

  it('処理時間が interval を超えた場合は待たずに次回を予約する', () => {
    expect(getNextScoreOcrDelay(1000, 100, 1300)).toBe(0);
  });
});
