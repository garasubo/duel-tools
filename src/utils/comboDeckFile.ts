import type { SavedDeck, SavedDeckSnapshot } from './comboDeckStorage';
import { upsertSavedDeck } from './comboDeckStorage';

export type DeckFileData = SavedDeckSnapshot & { name: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function serializeDeckFile(deck: DeckFileData): string {
  return JSON.stringify({
    format: 'duel-tools-combo-deck',
    version: 1,
    name: deck.name,
    deckSize: deck.deckSize,
    deckCounts: deck.deckCounts,
    patterns: deck.patterns,
    cardLabels: deck.cardLabels,
  }, null, 2);
}

export function parseDeckFile(text: string): DeckFileData {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('JSONファイルを読み取れませんでした。');
  }
  if (!isRecord(data) || data.format !== 'duel-tools-combo-deck') {
    throw new Error('初動率計算ツールからエクスポートしたJSONファイルを選択してください。');
  }
  if (data.version !== 1) {
    throw new Error('このファイルのバージョンには対応していません。');
  }
  if (
    typeof data.name !== 'string' || !data.name.trim() ||
    !isPositiveInteger(data.deckSize) ||
    !isRecord(data.deckCounts) ||
    !Object.values(data.deckCounts).every(isPositiveInteger) ||
    !isRecord(data.cardLabels) ||
    !Object.values(data.cardLabels).every((labels) =>
      Array.isArray(labels) && labels.every((label) => typeof label === 'string'),
    ) ||
    !Array.isArray(data.patterns) ||
    !data.patterns.every((pattern) => Array.isArray(pattern) && pattern.every((entry) =>
      isRecord(entry) && isPositiveInteger(entry.required) &&
      ((entry.type === 'card' && typeof entry.name === 'string') ||
        (entry.type === 'label' && typeof entry.label === 'string')),
    ))
  ) {
    throw new Error('デッキのデータが不正です。カード・枚数・ラベル・条件を確認してください。');
  }
  return {
    name: data.name.trim(),
    deckSize: data.deckSize,
    deckCounts: data.deckCounts,
    cardLabels: data.cardLabels,
    patterns: data.patterns,
  } as DeckFileData;
}

// ファイル内のIDは使用せず、同名デッキも別のデッキとして保存する。
export function appendImportedDeck(decks: SavedDeck[], deck: DeckFileData): SavedDeck[] {
  const names = new Set(decks.map((saved) => saved.name));
  let name = deck.name;
  for (let suffix = 2; names.has(name); suffix++) {
    name = `${deck.name} (${suffix})`;
  }
  return upsertSavedDeck(decks, name, deck);
}

export function downloadDeckFile(deck: DeckFileData): void {
  const blob = new Blob([serializeDeckFile(deck)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  // ファイル名に使用できない制御文字も置換する。
  // eslint-disable-next-line no-control-regex
  anchor.download = `${deck.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_') || 'deck'}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
