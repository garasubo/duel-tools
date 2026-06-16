import { afterEach, describe, expect, it } from 'vitest';
import {
  getProfileSnapshot,
  getTickFps,
  measure,
  measureAsync,
  recordSample,
  recordTick,
  resetProfile,
  setProfilerEnabled,
} from './captureProfiler';

afterEach(() => {
  setProfilerEnabled(false);
  resetProfile();
});

describe('captureProfiler', () => {
  it('disabled のとき measure は計測せず fn の戻り値だけ返す', () => {
    setProfilerEnabled(false);
    const result = measure('x', () => 42);
    expect(result).toBe(42);
    expect(getProfileSnapshot()).toHaveLength(0);
  });

  it('disabled のとき measureAsync も計測しない', async () => {
    setProfilerEnabled(false);
    const result = await measureAsync('x', async () => 'ok');
    expect(result).toBe('ok');
    expect(getProfileSnapshot()).toHaveLength(0);
  });

  it('enabled のとき count / total / max / avg を集計する', () => {
    setProfilerEnabled(true);
    recordSample('a', 10);
    recordSample('a', 30);
    const stat = getProfileSnapshot().find((s) => s.label === 'a');
    expect(stat).toBeDefined();
    expect(stat?.count).toBe(2);
    expect(stat?.totalMs).toBe(40);
    expect(stat?.avgMs).toBe(20);
    expect(stat?.maxMs).toBe(30);
    expect(stat?.lastMs).toBe(30);
  });

  it('measure は fn の戻り値を返しつつサンプルを記録する', () => {
    setProfilerEnabled(true);
    const result = measure('b', () => 7);
    expect(result).toBe(7);
    expect(getProfileSnapshot().find((s) => s.label === 'b')?.count).toBe(1);
  });

  it('recordTick / getTickFps は直近ウィンドウから fps を算出する', () => {
    setProfilerEnabled(true);
    // 0,100,...,500ms で 6 回 = 5 区間 / 0.5 秒 = 10fps
    for (let i = 0; i <= 5; i++) {
      recordTick('loop', i * 100);
    }
    expect(getTickFps('loop', 500)).toBeCloseTo(10, 5);
  });

  it('getTickFps はサンプル不足のとき 0 を返す', () => {
    setProfilerEnabled(true);
    recordTick('loop', 0);
    expect(getTickFps('loop', 0)).toBe(0);
  });

  it('resetProfile で集計とティックをクリアする', () => {
    setProfilerEnabled(true);
    recordSample('a', 10);
    recordTick('loop', 0);
    resetProfile();
    expect(getProfileSnapshot()).toHaveLength(0);
    expect(getTickFps('loop')).toBe(0);
  });
});
