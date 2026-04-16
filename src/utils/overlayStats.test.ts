import { describe, expect, it } from 'vitest';
import type { OverlayStatSetting } from '../types';
import {
  createDefaultOverlayStatSettings,
  isValidOverlayStatSettings,
  normalizeOverlayStatSettings,
} from './overlayStats';

describe('overlayStats helpers', () => {
  it('デフォルト設定は全項目表示で返す', () => {
    expect(createDefaultOverlayStatSettings()).toEqual([
      { id: 'overall', visible: true },
      { id: 'asFirst', visible: true },
      { id: 'asSecond', visible: true },
      { id: 'coinToss', visible: true },
      { id: 'matchCount', visible: true },
    ]);
  });

  it('有効な並び替え済み設定をそのまま受け入れる', () => {
    const settings = [
      { id: 'matchCount', visible: true },
      { id: 'coinToss', visible: true },
      { id: 'overall', visible: true },
      { id: 'asFirst', visible: false },
      { id: 'asSecond', visible: true },
    ] as const;

    expect(normalizeOverlayStatSettings(settings)).toEqual(settings);
    expect(isValidOverlayStatSettings([...settings])).toBe(true);
  });

  it('重複IDは無効として扱う', () => {
    const settings: OverlayStatSetting[] = [
      { id: 'overall', visible: true },
      { id: 'overall', visible: true },
      { id: 'asFirst', visible: true },
      { id: 'asSecond', visible: true },
      { id: 'coinToss', visible: true },
    ];

    expect(isValidOverlayStatSettings(settings)).toBe(false);
    expect(normalizeOverlayStatSettings(settings)).toEqual(
      createDefaultOverlayStatSettings(),
    );
  });

  it('未知のIDは無効として扱う', () => {
    const settings = [
      { id: 'overall', visible: true },
      { id: 'asFirst', visible: true },
      { id: 'asSecond', visible: true },
      { id: 'unknown', visible: true },
    ];

    expect(normalizeOverlayStatSettings(settings)).toEqual(
      createDefaultOverlayStatSettings(),
    );
  });

  it('全て非表示の設定は無効として扱う', () => {
    const settings: OverlayStatSetting[] = [
      { id: 'overall', visible: false },
      { id: 'asFirst', visible: false },
      { id: 'asSecond', visible: false },
      { id: 'coinToss', visible: false },
      { id: 'matchCount', visible: false },
    ];

    expect(isValidOverlayStatSettings(settings)).toBe(false);
    expect(normalizeOverlayStatSettings(settings)).toEqual(
      createDefaultOverlayStatSettings(),
    );
  });

  it('旧設定に試合数を補完して既存の順序と表示状態を維持する', () => {
    const settings = [
      { id: 'coinToss', visible: true },
      { id: 'overall', visible: true },
      { id: 'asFirst', visible: false },
      { id: 'asSecond', visible: true },
    ];

    expect(normalizeOverlayStatSettings(settings)).toEqual([
      { id: 'coinToss', visible: true },
      { id: 'overall', visible: true },
      { id: 'asFirst', visible: false },
      { id: 'asSecond', visible: true },
      { id: 'matchCount', visible: true },
    ]);
  });
});
