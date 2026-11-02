import { describe, expect, it } from 'vitest';
import { appendImportedDeck, parseDeckFile, serializeDeckFile, type DeckFileData } from './comboDeckFile';
import { readSavedDecks, writeSavedDecks } from './comboDeckStorage';

const deck: DeckFileData = {
  name: 'テストデッキ',
  deckSize: 40,
  deckCounts: { 'カードA': 3, 'カードB': 2 },
  cardLabels: { 'カードA': ['初動', 'モンスター'], 'カードB': ['初動'] },
  patterns: [
    [{ type: 'card', name: 'カードA', required: 1 }],
    [{ type: 'label', label: '初動', required: 2 }],
    [],
  ],
};

describe('デッキファイル', () => {
  it('日本語名・枚数・ラベル・複数条件を欠落なく復元して永続化できる', () => {
    const parsed = parseDeckFile(serializeDeckFile(deck));
    expect(parsed).toEqual(deck);
    const saved = appendImportedDeck([], parsed);
    let stored = '';
    const storage = { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } };
    writeSavedDecks(saved, storage);
    expect(readSavedDecks(storage)).toEqual(saved);
    expect(serializeDeckFile(saved[0])).not.toContain('updatedAt');
    expect(serializeDeckFile(saved[0])).not.toContain('"id"');
  });

  it('未完成のデッキも保持し、BOM付きJSONも読み込める', () => {
    const unfinished = { ...deck, patterns: [], cardLabels: {}, deckCounts: { A: 41 } };
    expect(parseDeckFile('\uFEFF' + serializeDeckFile(unfinished))).toEqual(unfinished);
  });

  it('同名デッキを上書きせず新しいIDと連番で追加する', () => {
    const first = appendImportedDeck([], deck);
    const second = appendImportedDeck(first, deck);
    const third = appendImportedDeck(second, deck);
    expect(third.map((saved) => saved.name)).toEqual(['テストデッキ', 'テストデッキ (2)', 'テストデッキ (3)']);
    expect(new Set(third.map((saved) => saved.id)).size).toBe(3);
    expect(third.slice(0, 2)).toEqual(second);
    expect(first).toHaveLength(1);
  });

  it.each(['invalid', 'null', '[]', '{}'])('不正なファイルを拒否する: %s', (text) => {
    expect(() => parseDeckFile(text)).toThrow();
  });

  it('未対応のバージョンを拒否する', () => {
    const data = JSON.parse(serializeDeckFile(deck));
    expect(() => parseDeckFile(JSON.stringify({ ...data, version: 2 }))).toThrow('バージョン');
  });

  it.each([
    { name: ' ' }, { deckSize: 0 }, { deckSize: 40.5 },
    { deckCounts: null }, { deckCounts: { A: -1 } }, { deckCounts: { A: 1.5 } },
    { deckCounts: { A: '3' } }, { cardLabels: { A: [1] } },
    { patterns: [null] }, { patterns: [[{ type: 'card', name: 'A', required: 0 }]] },
    { patterns: [[{ type: 'unknown', name: 'A', required: 1 }]] },
    { patterns: [[{ type: 'label', required: 1 }]] },
  ])('壊れたデータを黙って削除せず拒否する: %j', (invalid) => {
    const data = JSON.parse(serializeDeckFile(deck));
    expect(() => parseDeckFile(JSON.stringify({ ...data, ...invalid }))).toThrow('データが不正');
  });
});
