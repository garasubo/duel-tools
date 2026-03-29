import type { BattleRecord, Deck } from '../types';
import { formatDate } from './formatDate';

const RESULT_LABELS: Record<string, string> = {
  win: '○',
  loss: '×',
};

const TURN_ORDER_LABELS: Record<string, string> = {
  first: '先攻',
  second: '後攻',
  third: 'ゆずられ先攻',
};

function escape(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

export function buildCsvString(
  records: BattleRecord[],
  ownDecks: Deck[],
  opponentDecks: Deck[],
): string {
  const ownDeckMap = new Map(ownDecks.map((d) => [d.id, d.name]));
  const opponentDeckMap = new Map(opponentDecks.map((d) => [d.id, d.name]));

  const headers = ['日時', '自分のデッキ', '相手のデッキ', '手番', '結果', 'タグ', 'メモ'];
  const rows = records.map((r) => [
    formatDate(r.createdAt),
    ownDeckMap.get(r.ownDeckId) ?? r.ownDeckId,
    opponentDeckMap.get(r.opponentDeckId) ?? r.opponentDeckId,
    TURN_ORDER_LABELS[r.turnOrder] ?? r.turnOrder,
    RESULT_LABELS[r.result] ?? r.result,
    r.reasonTags.join(' '),
    r.memo,
  ]);

  const lines = [headers, ...rows].map((row) => row.map(escape).join(','));
  // UTF-8 BOM（Excelで開いた際の日本語文字化け防止）
  return '\uFEFF' + lines.join('\r\n');
}
