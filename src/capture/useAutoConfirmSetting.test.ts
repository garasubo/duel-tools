import { describe, expect, it } from 'vitest';
import {
  AUTO_CONFIRM_STORAGE_KEY,
  readAutoConfirmEnabled,
  writeAutoConfirmEnabled,
} from './useAutoConfirmSetting';

function createStorage(initialValue: string | null = null) {
  const values = new Map<string, string>();
  if (initialValue !== null) values.set(AUTO_CONFIRM_STORAGE_KEY, initialValue);

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe('useAutoConfirmSetting storage helpers', () => {
  it('保存値が 1 の場合だけ有効として読む', () => {
    expect(readAutoConfirmEnabled(createStorage('1'))).toBe(true);
    expect(readAutoConfirmEnabled(createStorage('0'))).toBe(false);
    expect(readAutoConfirmEnabled(createStorage())).toBe(false);
    expect(readAutoConfirmEnabled(undefined)).toBe(false);
  });

  it('有効状態を 1 / 0 で保存する', () => {
    const storage = createStorage();

    writeAutoConfirmEnabled(true, storage);
    expect(storage.getItem(AUTO_CONFIRM_STORAGE_KEY)).toBe('1');

    writeAutoConfirmEnabled(false, storage);
    expect(storage.getItem(AUTO_CONFIRM_STORAGE_KEY)).toBe('0');
  });
});
