import { describe, expect, it } from 'vitest';
import { advanceRatingStreak, EMPTY_RATING_STREAK } from './useRatingCaptureLoop';

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
