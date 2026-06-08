import { describe, expect, it } from 'vitest';
import {
  HIGH_CONFIDENCE_REQUIRED_CONSECUTIVE,
  REQUIRED_CONSECUTIVE,
} from './captureTiming';
import { advanceResultStreak, applyMissToStreak } from './useResultCaptureLoop';
import type { ResultStreakState } from './useResultCaptureLoop';

const EMPTY_STREAK: ResultStreakState = {
  lastResult: null,
  consecutiveCount: 0,
  recentResults: [],
  missCount: 0,
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

  it('画像特徴の確定的一致（信頼度92）は1フレームで即 pending になる', () => {
    const update = advanceResultStreak(EMPTY_STREAK, { result: 'loss', confidence: 92 });
    expect(update.requiredConsecutiveCount).toBe(1);
    expect(update.consecutiveCount).toBe(1);
    expect(update.pendingResult).toEqual({ result: 'loss', confidence: 92 });
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

describe('applyMissToStreak', () => {
  it('単発の空振りでは進行中の streak をリセットしない', () => {
    let update = advanceResultStreak(EMPTY_STREAK, { result: 'loss', confidence: 80 });
    expect(update.consecutiveCount).toBe(1);

    // 演出フレーム等で 1 回空振り
    const afterMiss = applyMissToStreak(update.nextStreak);
    expect(afterMiss.consecutiveCount).toBe(1);
    expect(afterMiss.lastResult).toBe('loss');
    expect(afterMiss.missCount).toBe(1);

    // 同じ結果が再び来たら連続数は継続する
    update = advanceResultStreak(afterMiss, { result: 'loss', confidence: 80 });
    expect(update.consecutiveCount).toBe(2);
    expect(update.nextStreak.missCount).toBe(0);
  });

  it('空振りが2回連続すると EMPTY_STREAK に戻る', () => {
    const update = advanceResultStreak(EMPTY_STREAK, { result: 'loss', confidence: 80 });
    const afterFirstMiss = applyMissToStreak(update.nextStreak);
    const afterSecondMiss = applyMissToStreak(afterFirstMiss);
    expect(afterSecondMiss).toEqual(EMPTY_STREAK);
  });

  it('streak が無いときの空振りは EMPTY_STREAK のまま', () => {
    expect(applyMissToStreak(EMPTY_STREAK)).toEqual(EMPTY_STREAK);
  });
});
