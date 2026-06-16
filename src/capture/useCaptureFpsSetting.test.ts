import { describe, expect, it } from 'vitest';
import {
  CAPTURE_FPS_STORAGE_KEY,
  DEFAULT_CAPTURE_FPS,
  readCaptureFps,
  writeCaptureFps,
} from './useCaptureFpsSetting';

function createStorage(initialValue: string | null = null) {
  const values = new Map<string, string>();
  if (initialValue !== null) values.set(CAPTURE_FPS_STORAGE_KEY, initialValue);

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe('useCaptureFpsSetting storage helpers', () => {
  it('プリセットに含まれる値はそのまま読む', () => {
    expect(readCaptureFps(createStorage('30'))).toBe(30);
    expect(readCaptureFps(createStorage('20'))).toBe(20);
    expect(readCaptureFps(createStorage('15'))).toBe(15);
    expect(readCaptureFps(createStorage('10'))).toBe(10);
  });

  it('未設定・不正値は既定値にフォールバックする', () => {
    expect(readCaptureFps(createStorage())).toBe(DEFAULT_CAPTURE_FPS);
    expect(readCaptureFps(createStorage('25'))).toBe(DEFAULT_CAPTURE_FPS);
    expect(readCaptureFps(createStorage('abc'))).toBe(DEFAULT_CAPTURE_FPS);
    expect(readCaptureFps(undefined)).toBe(DEFAULT_CAPTURE_FPS);
  });

  it('選択値を文字列で保存する', () => {
    const storage = createStorage();

    writeCaptureFps(15, storage);
    expect(storage.getItem(CAPTURE_FPS_STORAGE_KEY)).toBe('15');

    writeCaptureFps(10, storage);
    expect(storage.getItem(CAPTURE_FPS_STORAGE_KEY)).toBe('10');
  });
});
