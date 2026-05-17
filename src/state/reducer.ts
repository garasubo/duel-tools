import type {
  AppStorage,
  BattleRecord,
  Deck,
  OverlayStatSetting,
  PanelDateFilter,
} from "../types";
import { addDeckIfMissing, findDeckByName, normalizeDeckName } from "../utils/decks";
import type { CsvImportRow } from "../utils/csvImportHelpers";
import { isValidOverlayStatSettings } from "../utils/overlayStats";

export type DeckKey = "ownDecks" | "opponentDecks";

export type NewRecord = Omit<BattleRecord, "id" | "createdAt">;
export type RecordPatch = Partial<Omit<BattleRecord, "id" | "createdAt">>;

function newId(): string {
  return crypto.randomUUID();
}

export function reduceAddRecord(state: AppStorage, payload: NewRecord): AppStorage {
  const newRecord: BattleRecord = {
    ...payload,
    id: newId(),
    createdAt: new Date().toISOString(),
  };
  const newTags = payload.reasonTags.filter((t) => !state.knownTags.includes(t));
  return {
    ...state,
    records: [newRecord, ...state.records],
    knownTags: newTags.length === 0 ? state.knownTags : [...state.knownTags, ...newTags],
  };
}

export function reduceUpdateRecord(
  state: AppStorage,
  id: string,
  patch: RecordPatch,
): AppStorage {
  return {
    ...state,
    records: state.records.map((r) => (r.id === id ? { ...r, ...patch } : r)),
  };
}

export function reduceDeleteRecord(state: AppStorage, id: string): AppStorage {
  return {
    ...state,
    records: state.records.filter((r) => r.id !== id),
  };
}

export function reduceDeleteRecords(state: AppStorage, ids: string[]): AppStorage {
  if (ids.length === 0) return state;
  const idSet = new Set(ids);
  return {
    ...state,
    records: state.records.filter((r) => !idSet.has(r.id)),
  };
}

export function reduceImportRecords(
  state: AppStorage,
  rows: CsvImportRow[],
): { state: AppStorage; importedCount: number } {
  if (rows.length === 0) {
    return { state, importedCount: 0 };
  }

  let ownDecks = state.ownDecks;
  let opponentDecks = state.opponentDecks;
  const knownTagSet = new Set(state.knownTags);
  const newTags: string[] = [];
  const newRecords: BattleRecord[] = [];

  for (const row of rows) {
    const ownResult = addDeckIfMissing(ownDecks, row.ownDeckName, newId);
    ownDecks = ownResult.decks;
    const ownDeckId = ownResult.deck.id;

    let opponentDeckId = "";
    if (normalizeDeckName(row.opponentDeckName) !== "") {
      const oppResult = addDeckIfMissing(opponentDecks, row.opponentDeckName, newId);
      opponentDecks = oppResult.decks;
      opponentDeckId = oppResult.deck.id;
    }

    for (const tag of row.reasonTags) {
      if (!knownTagSet.has(tag)) {
        knownTagSet.add(tag);
        newTags.push(tag);
      }
    }

    const record: BattleRecord = {
      id: newId(),
      createdAt: row.createdAt,
      ownDeckId,
      opponentDeckId,
      result: row.result,
      turnOrder: row.turnOrder,
      ...(row.battleMode !== undefined ? { battleMode: row.battleMode } : {}),
      ...(row.score !== undefined ? { score: row.score } : {}),
      reasonTags: row.reasonTags,
      memo: row.memo,
    };
    newRecords.push(record);
  }

  return {
    state: {
      ...state,
      records: [...newRecords, ...state.records],
      ownDecks,
      opponentDecks,
      knownTags: newTags.length === 0 ? state.knownTags : [...state.knownTags, ...newTags],
    },
    importedCount: newRecords.length,
  };
}

export function reduceAddDeck(
  state: AppStorage,
  key: DeckKey,
  name: string,
): { state: AppStorage; deck: Deck } {
  const normalized = normalizeDeckName(name);
  const existing = findDeckByName(state[key], normalized);
  if (existing) {
    return { state, deck: existing };
  }
  const deck: Deck = { id: newId(), name: normalized };
  return {
    state: { ...state, [key]: [...state[key], deck] },
    deck,
  };
}

export function reduceUpdateDeck(
  state: AppStorage,
  key: DeckKey,
  id: string,
  name: string,
): AppStorage {
  return {
    ...state,
    [key]: state[key].map((d) => (d.id === id ? { ...d, name } : d)),
  };
}

export function reduceDeleteDeck(
  state: AppStorage,
  key: DeckKey,
  id: string,
): AppStorage {
  return {
    ...state,
    [key]: state[key].filter((d) => d.id !== id),
  };
}

export function reduceAddTag(state: AppStorage, tag: string): AppStorage {
  if (state.knownTags.includes(tag)) return state;
  return { ...state, knownTags: [...state.knownTags, tag] };
}

export function reduceRenameTag(
  state: AppStorage,
  oldTag: string,
  newTag: string,
): AppStorage {
  if (oldTag === newTag) return state;
  if (!state.knownTags.includes(oldTag)) return state;
  return {
    ...state,
    knownTags: state.knownTags.map((t) => (t === oldTag ? newTag : t)),
    records: state.records.map((r) =>
      r.reasonTags.includes(oldTag)
        ? { ...r, reasonTags: r.reasonTags.map((t) => (t === oldTag ? newTag : t)) }
        : r,
    ),
  };
}

export function reduceDeleteTag(state: AppStorage, tag: string): AppStorage {
  if (!state.knownTags.includes(tag)) return state;
  return {
    ...state,
    knownTags: state.knownTags.filter((t) => t !== tag),
    records: state.records.map((r) =>
      r.reasonTags.includes(tag)
        ? { ...r, reasonTags: r.reasonTags.filter((t) => t !== tag) }
        : r,
    ),
  };
}

export function reduceSetOverlayStats(
  state: AppStorage,
  stats: OverlayStatSetting[],
): AppStorage {
  if (!isValidOverlayStatSettings(stats)) {
    throw new Error("Invalid overlay stat settings");
  }
  return { ...state, overlayStats: stats };
}

export function reduceSetPanelDateFilter(
  state: AppStorage,
  filter: PanelDateFilter,
): AppStorage {
  return { ...state, panelDateFilter: filter };
}
