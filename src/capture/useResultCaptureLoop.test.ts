import { describe, expect, it } from 'vitest';
import {
  HIGH_CONFIDENCE_REQUIRED_CONSECUTIVE,
  REQUIRED_CONSECUTIVE,
  TENTATIVE_RESCUE_WINDOW_MS,
} from './captureTiming';
import {
  advanceResultStreak,
  applyMissToStreak,
  isTentativeExpired,
  trackTentativeCandidate,
} from './useResultCaptureLoop';
import type { ResultStreakState, TentativeCandidate } from './useResultCaptureLoop';

const EMPTY_STREAK: ResultStreakState = {
  lastResult: null,
  consecutiveCount: 0,
  recentResults: [],
  missCount: 0,
  firstMatchAt: null,
};

describe('advanceResultStreak', () => {
  it('低信頼度の候補は通常回数の連続一致かつ最小経過時間で pending になる', () => {
    let streak = EMPTY_STREAK;
    let update = advanceResultStreak(streak, { result: 'win', confidence: 70 }, 0);
    streak = update.nextStreak;
    expect(update.pendingResult).toBeNull();
    expect(update.consecutiveCount).toBe(1);
    expect(update.requiredConsecutiveCount).toBe(REQUIRED_CONSECUTIVE);

    update = advanceResultStreak(streak, { result: 'win', confidence: 75 }, 350);
    streak = update.nextStreak;
    expect(update.pendingResult).toBeNull();
    expect(update.consecutiveCount).toBe(2);

    update = advanceResultStreak(streak, { result: 'win', confidence: 80 }, 700);
    expect(update.pendingResult).toEqual({ result: 'win', confidence: 75 });
    expect(update.consecutiveCount).toBe(REQUIRED_CONSECUTIVE);
  });

  it('回数を満たしても最小経過時間に達しなければ pending にしない（30fps の誤確定防止）', () => {
    // 33ms 間隔で 3 連続一致しても elapsed=66ms < MIN_CONFIRM_DURATION_MS のため未確定。
    let streak = EMPTY_STREAK;
    let update = advanceResultStreak(streak, { result: 'win', confidence: 70 }, 0);
    streak = update.nextStreak;
    update = advanceResultStreak(streak, { result: 'win', confidence: 75 }, 33);
    streak = update.nextStreak;
    update = advanceResultStreak(streak, { result: 'win', confidence: 80 }, 66);
    expect(update.consecutiveCount).toBe(3);
    expect(update.pendingResult).toBeNull();
  });

  it('画像特徴の確定的一致（信頼度92）は1フレームで即 pending になる（時間条件なし）', () => {
    const update = advanceResultStreak(EMPTY_STREAK, { result: 'loss', confidence: 92 }, 1000);
    expect(update.requiredConsecutiveCount).toBe(1);
    expect(update.consecutiveCount).toBe(1);
    expect(update.pendingResult).toEqual({ result: 'loss', confidence: 92 });
  });

  it('高信頼度の候補は短縮回数かつ最小経過時間で pending になる', () => {
    let streak = EMPTY_STREAK;
    let update = advanceResultStreak(streak, { result: 'loss', confidence: 90 }, 0);
    streak = update.nextStreak;
    expect(update.pendingResult).toBeNull();
    expect(update.requiredConsecutiveCount).toBe(HIGH_CONFIDENCE_REQUIRED_CONSECUTIVE);

    update = advanceResultStreak(streak, { result: 'loss', confidence: 86 }, 300);
    expect(update.pendingResult).toEqual({ result: 'loss', confidence: 88 });
    expect(update.consecutiveCount).toBe(HIGH_CONFIDENCE_REQUIRED_CONSECUTIVE);
  });

  it('違う結果が混ざると連続数と直近結果をリセットする', () => {
    let update = advanceResultStreak(EMPTY_STREAK, { result: 'win', confidence: 90 }, 0);
    update = advanceResultStreak(update.nextStreak, { result: 'loss', confidence: 70 }, 33);

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

describe('trackTentativeCandidate', () => {
  it('候補が無ければ今回の検出をそのまま保持する', () => {
    const next = trackTentativeCandidate(null, { result: 'loss', confidence: 88 }, 100);
    expect(next).toEqual({ result: { result: 'loss', confidence: 88 }, lastSeenAt: 100 });
  });

  it('より高信頼（同値含む）の候補で差し替え、観測時刻を更新する', () => {
    const current: TentativeCandidate = {
      result: { result: 'loss', confidence: 70 },
      lastSeenAt: 100,
    };
    const next = trackTentativeCandidate(current, { result: 'win', confidence: 85 }, 200);
    expect(next).toEqual({ result: { result: 'win', confidence: 85 }, lastSeenAt: 200 });
  });

  it('低信頼の候補では結果を据え置き、最終観測時刻だけ更新して窓を延命する', () => {
    const current: TentativeCandidate = {
      result: { result: 'loss', confidence: 88 },
      lastSeenAt: 100,
    };
    const next = trackTentativeCandidate(current, { result: 'loss', confidence: 65 }, 200);
    expect(next).toEqual({ result: { result: 'loss', confidence: 88 }, lastSeenAt: 200 });
  });
});

describe('isTentativeExpired', () => {
  const tentative: TentativeCandidate = {
    result: { result: 'loss', confidence: 88 },
    lastSeenAt: 1000,
  };

  it('救済窓内なら期限切れにしない（境界含む）', () => {
    expect(isTentativeExpired(tentative, 1000)).toBe(false);
    expect(isTentativeExpired(tentative, 1000 + TENTATIVE_RESCUE_WINDOW_MS)).toBe(false);
  });

  it('救済窓を過ぎたら期限切れにする', () => {
    expect(isTentativeExpired(tentative, 1000 + TENTATIVE_RESCUE_WINDOW_MS + 1)).toBe(true);
  });
});
