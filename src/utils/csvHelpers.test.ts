import { describe, it, expect } from 'vitest';
import { buildCsvString } from './csvHelpers';
import type { BattleRecord, Deck } from '../types';

const ownDecks: Deck[] = [{ id: 'own-1', name: '青眼の白龍' }];
const opponentDecks: Deck[] = [{ id: 'opp-1', name: 'ブラック・マジシャン' }];

const record: BattleRecord = {
  id: 'rec-1',
  createdAt: '2026-03-28T10:00:00.000Z',
  ownDeckId: 'own-1',
  opponentDeckId: 'opp-1',
  result: 'win',
  turnOrder: 'first',
  reasonTags: ['有利展開', 'ミスなし'],
  memo: 'メモ内容',
};

describe('buildCsvString', () => {
  it('UTF-8 BOMで始まる', () => {
    const csv = buildCsvString([record], ownDecks, opponentDecks);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('ヘッダー行が正しい', () => {
    const csv = buildCsvString([], ownDecks, opponentDecks);
    const firstLine = csv.slice(1).split('\r\n')[0];
    expect(firstLine).toBe('"日時","自分のデッキ","相手のデッキ","結果","手番","タグ","メモ"');
  });

  it('デッキ名・結果・手番が日本語に変換される', () => {
    const csv = buildCsvString([record], ownDecks, opponentDecks);
    const dataLine = csv.slice(1).split('\r\n')[1];
    expect(dataLine).toContain('"青眼の白龍"');
    expect(dataLine).toContain('"ブラック・マジシャン"');
    expect(dataLine).toContain('"勝ち"');
    expect(dataLine).toContain('"先行"');
  });

  it('タグはスペース区切りで結合される', () => {
    const csv = buildCsvString([record], ownDecks, opponentDecks);
    const dataLine = csv.slice(1).split('\r\n')[1];
    expect(dataLine).toContain('"有利展開 ミスなし"');
  });

  it('デッキIDが見つからない場合はIDをそのまま出力する', () => {
    const unknownRecord = { ...record, ownDeckId: 'unknown-id' };
    const csv = buildCsvString([unknownRecord], ownDecks, opponentDecks);
    const dataLine = csv.slice(1).split('\r\n')[1];
    expect(dataLine).toContain('"unknown-id"');
  });

  it('ダブルクォートを含む文字列はエスケープされる', () => {
    const recordWithQuote = { ...record, memo: '彼は"勝った"と言った' };
    const csv = buildCsvString([recordWithQuote], ownDecks, opponentDecks);
    expect(csv).toContain('彼は""勝った""と言った');
  });
});
