import type {
  CardLabels,
  DeckCounts,
  Pattern,
  PatternEntry,
  Patterns,
} from './starterRate';

export const SAVED_DECKS_STORAGE_KEY = 'duel-tools:combo-saved-decks-v1';

// 初動率計算のデッキ構築（カード・枚数・パターン条件・ラベル）を
// 名前付きで localStorage に保存するためのデータ構造。
export interface SavedDeck {
  id: string;
  name: string;
  deckSize: number;
  deckCounts: DeckCounts;
  patterns: Patterns;
  cardLabels: CardLabels;
  updatedAt: number;
}

// 保存対象となるデッキ構築のスナップショット（id / 名前 / 更新時刻を除く）。
export type SavedDeckSnapshot = Pick<
  SavedDeck,
  'deckSize' | 'deckCounts' | 'patterns' | 'cardLabels'
>;

type SavedDecksStorage = Pick<Storage, 'getItem' | 'setItem'>;

function getStorage(): SavedDecksStorage | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage;
}

export function generateDeckId(): string {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `deck-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeDeckCounts(value: unknown): DeckCounts {
  if (!isRecord(value)) return {};
  const result: DeckCounts = {};
  for (const [name, count] of Object.entries(value)) {
    if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
      result[name] = count;
    }
  }
  return result;
}

function normalizeCardLabels(value: unknown): CardLabels {
  if (!isRecord(value)) return {};
  const result: CardLabels = {};
  for (const [name, labels] of Object.entries(value)) {
    if (Array.isArray(labels)) {
      const strings = labels.filter(
        (label): label is string => typeof label === 'string',
      );
      if (strings.length > 0) result[name] = strings;
    }
  }
  return result;
}

function normalizePatternEntry(value: unknown): PatternEntry | null {
  if (!isRecord(value)) return null;
  const required = value.required;
  if (typeof required !== 'number' || !Number.isFinite(required)) return null;
  if (value.type === 'card' && typeof value.name === 'string') {
    return { type: 'card', name: value.name, required };
  }
  if (value.type === 'label' && typeof value.label === 'string') {
    return { type: 'label', label: value.label, required };
  }
  return null;
}

function normalizePatterns(value: unknown): Patterns {
  if (!Array.isArray(value)) return [];
  const patterns: Patterns = [];
  for (const rawPattern of value) {
    if (!Array.isArray(rawPattern)) continue;
    const pattern: Pattern = [];
    for (const rawEntry of rawPattern) {
      const entry = normalizePatternEntry(rawEntry);
      if (entry) pattern.push(entry);
    }
    patterns.push(pattern);
  }
  return patterns;
}

function normalizeSavedDeck(value: unknown): SavedDeck | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id : null;
  const name = typeof value.name === 'string' ? value.name : null;
  if (!id || !name) return null;
  const deckSize =
    typeof value.deckSize === 'number' &&
    Number.isFinite(value.deckSize) &&
    value.deckSize > 0
      ? value.deckSize
      : 40;
  const updatedAt =
    typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt)
      ? value.updatedAt
      : 0;
  return {
    id,
    name,
    deckSize,
    deckCounts: normalizeDeckCounts(value.deckCounts),
    patterns: normalizePatterns(value.patterns),
    cardLabels: normalizeCardLabels(value.cardLabels),
    updatedAt,
  };
}

export function readSavedDecks(
  storage: SavedDecksStorage | undefined = getStorage(),
): SavedDeck[] {
  const raw = storage?.getItem(SAVED_DECKS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeSavedDeck)
      .filter((deck): deck is SavedDeck => deck !== null);
  } catch {
    return [];
  }
}

export function writeSavedDecks(
  decks: SavedDeck[],
  storage: SavedDecksStorage | undefined = getStorage(),
): void {
  storage?.setItem(SAVED_DECKS_STORAGE_KEY, JSON.stringify(decks));
}

// 指定名でスナップショットを保存する。同名のデッキが既にある場合は上書きする。
export function upsertSavedDeck(
  decks: SavedDeck[],
  name: string,
  snapshot: SavedDeckSnapshot,
  now: number = Date.now(),
): SavedDeck[] {
  const trimmed = name.trim();
  const existing = decks.find((deck) => deck.name === trimmed);
  const saved: SavedDeck = {
    id: existing?.id ?? generateDeckId(),
    name: trimmed,
    deckSize: snapshot.deckSize,
    deckCounts: snapshot.deckCounts,
    patterns: snapshot.patterns,
    cardLabels: snapshot.cardLabels,
    updatedAt: now,
  };
  if (existing) {
    return decks.map((deck) => (deck.id === existing.id ? saved : deck));
  }
  return [...decks, saved];
}

export function deleteSavedDeck(decks: SavedDeck[], id: string): SavedDeck[] {
  return decks.filter((deck) => deck.id !== id);
}
