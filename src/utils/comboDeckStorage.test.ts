import { describe, expect, it } from 'vitest';
import type { SavedDeck } from './comboDeckStorage';
import {
  SAVED_DECKS_STORAGE_KEY,
  deleteSavedDeck,
  readSavedDecks,
  upsertSavedDeck,
  writeSavedDecks,
} from './comboDeckStorage';

function createStorage(initialValue: string | null = null) {
  const values = new Map<string, string>();
  if (initialValue !== null) values.set(SAVED_DECKS_STORAGE_KEY, initialValue);

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

const sampleDeck: SavedDeck = {
  id: 'deck-1',
  name: 'テストデッキ',
  deckSize: 40,
  deckCounts: { 増殖するG: 3, 灰流うらら: 3 },
  patterns: [[{ type: 'card', name: '増殖するG', required: 1 }]],
  cardLabels: { 灰流うらら: ['手札誘発'] },
  updatedAt: 1000,
};

describe('comboDeckStorage read/write', () => {
  it('保存したデッキをそのまま読み出せる', () => {
    const storage = createStorage();
    writeSavedDecks([sampleDeck], storage);
    expect(readSavedDecks(storage)).toEqual([sampleDeck]);
  });

  it('未設定・不正 JSON は空配列を返す', () => {
    expect(readSavedDecks(createStorage())).toEqual([]);
    expect(readSavedDecks(createStorage('not-json'))).toEqual([]);
    expect(readSavedDecks(createStorage('{"a":1}'))).toEqual([]);
    expect(readSavedDecks(undefined)).toEqual([]);
  });

  it('壊れたエントリを除外・正規化して読み出す', () => {
    const storage = createStorage(
      JSON.stringify([
        sampleDeck,
        { name: 'id なし' },
        {
          id: 'deck-2',
          name: '不正値混在',
          deckSize: -5,
          deckCounts: { 有効: 2, 無効: -1, 文字列: 'x' },
          patterns: [
            [
              { type: 'card', name: 'ok', required: 1 },
              { type: 'card', required: 1 },
              { type: 'unknown', required: 1 },
            ],
            'not-array',
          ],
          cardLabels: { a: ['x', 3], b: [], c: 'no' },
        },
      ]),
    );

    const decks = readSavedDecks(storage);
    expect(decks).toHaveLength(2);
    expect(decks[0]).toEqual(sampleDeck);
    expect(decks[1]).toEqual({
      id: 'deck-2',
      name: '不正値混在',
      deckSize: 40,
      deckCounts: { 有効: 2 },
      patterns: [[{ type: 'card', name: 'ok', required: 1 }]],
      cardLabels: { a: ['x'] },
      updatedAt: 0,
    });
  });
});

describe('upsertSavedDeck', () => {
  const snapshot = {
    deckSize: 40,
    deckCounts: { A: 3 },
    patterns: [],
    cardLabels: {},
  };

  it('新規名は追加される', () => {
    const result = upsertSavedDeck([sampleDeck], '新デッキ', snapshot, 2000);
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({
      name: '新デッキ',
      deckSize: 40,
      deckCounts: { A: 3 },
      updatedAt: 2000,
    });
    expect(result[1].id).not.toBe(sampleDeck.id);
  });

  it('同名は id を保ちつつ上書きされる', () => {
    const result = upsertSavedDeck([sampleDeck], 'テストデッキ', snapshot, 3000);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'deck-1',
      name: 'テストデッキ',
      deckSize: 40,
      deckCounts: { A: 3 },
      patterns: [],
      cardLabels: {},
      updatedAt: 3000,
    });
  });

  it('名前の前後空白を除去して保存する', () => {
    const result = upsertSavedDeck([], '  空白  ', snapshot, 4000);
    expect(result[0].name).toBe('空白');
  });
});

describe('deleteSavedDeck', () => {
  it('指定 id を削除する', () => {
    const other: SavedDeck = { ...sampleDeck, id: 'deck-2', name: '別' };
    expect(deleteSavedDeck([sampleDeck, other], 'deck-1')).toEqual([other]);
  });
});
