import { describe, expect, it } from 'vitest';
import {
  HIGH_CONFIDENCE_REQUIRED_CONSECUTIVE,
  REQUIRED_CONSECUTIVE,
} from './captureTiming';
import { advanceResultStreak } from './useResultCaptureLoop';
import type { ResultStreakState } from './useResultCaptureLoop';

const EMPTY_STREAK: ResultStreakState = {
  lastResult: null,
  consecutiveCount: 0,
  recentResults: [],
};

describe('advanceResultStreak', () => {
  it('低信頼度の候補は通常回数の連続一致で pending になる', () => {
    let streak = EMPTY_STREAK;
    let update = advanceResultStreak(streak, { result: 'win', confidence: 70 });
    streak = update.nextStreak;
    expect(update.pendingResult).toBeNull();
    expect(update.consecutiveCount).toBe(1);
    expect(update.requiredConsecutiveCount).toBe(REQUIRED_CONSECUTIVE);

    update = advanceResultStreak(streak, { result: 'win', confidence: 75 });
    streak = update.nextStreak;
    expect(update.pendingResult).toBeNull();
    expect(update.consecutiveCount).toBe(2);

    update = advanceResultStreak(streak, { result: 'win', confidence: 80 });
    expect(update.pendingResult).toEqual({ result: 'win', confidence: 75 });
    expect(update.consecutiveCount).toBe(REQUIRED_CONSECUTIVE);
  });

  it('高信頼度の候補は短縮回数の連続一致で pending になる', () => {
    let streak = EMPTY_STREAK;
    let update = advanceResultStreak(streak, { result: 'loss', confidence: 90 });
    streak = update.nextStreak;
    expect(update.pendingResult).toBeNull();
    expect(update.requiredConsecutiveCount).toBe(HIGH_CONFIDENCE_REQUIRED_CONSECUTIVE);

    update = advanceResultStreak(streak, { result: 'loss', confidence: 86 });
    expect(update.pendingResult).toEqual({ result: 'loss', confidence: 88 });
    expect(update.consecutiveCount).toBe(HIGH_CONFIDENCE_REQUIRED_CONSECUTIVE);
  });

  it('違う結果が混ざると連続数と直近結果をリセットする', () => {
    let update = advanceResultStreak(EMPTY_STREAK, { result: 'win', confidence: 90 });
    update = advanceResultStreak(update.nextStreak, { result: 'loss', confidence: 70 });

    expect(update.pendingResult).toBeNull();
    expect(update.lastOcrResult).toBe('loss');
    expect(update.consecutiveCount).toBe(1);
    expect(update.nextStreak.recentResults).toEqual([{ result: 'loss', confidence: 70 }]);
  });
});
