import { describe, expect, it } from 'vitest';
import { createDefaultStorage, normalizeStorage } from './storage';

describe('normalizeStorage', () => {
  it('空の入力ではoverlay設定を含むデフォルト値を返す', () => {
    expect(normalizeStorage(undefined)).toEqual(createDefaultStorage());
  });

  it('旧ストレージ形式でもoverlay設定を補完する', () => {
    const storage = normalizeStorage({
      records: [],
      ownDecks: [],
      opponentDecks: [],
      knownTags: ['有利展開'],
    });

    expect(storage.knownTags).toEqual(['有利展開']);
    expect(storage.overlayStats).toEqual(createDefaultStorage().overlayStats);
  });

  it('並び替え済みのoverlay設定を保持する', () => {
    const storage = normalizeStorage({
      records: [],
      ownDecks: [],
      opponentDecks: [],
      knownTags: [],
      overlayStats: [
        { id: 'coinToss', visible: true },
        { id: 'overall', visible: true },
        { id: 'asFirst', visible: false },
        { id: 'asSecond', visible: true },
      ],
    });

    expect(storage.overlayStats).toEqual([
      { id: 'coinToss', visible: true },
      { id: 'overall', visible: true },
      { id: 'asFirst', visible: false },
      { id: 'asSecond', visible: true },
      { id: 'matchCount', visible: true },
    ]);
  });
});
