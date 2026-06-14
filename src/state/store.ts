import type {
  AppStorage,
  Deck,
  OverlayStatSetting,
  PanelDateFilter,
  TurnOrder,
} from "../types";
import { DRAFT_TURN_ORDER_KEY, STORAGE_KEY } from "../utils/constants";
import {
  createDefaultStorage,
  normalizeStorage,
} from "../utils/storage";
import type { CsvImportRow } from "../utils/csvImportHelpers";
import {
  reduceAddDeck,
  reduceAddRecord,
  reduceAddTag,
  reduceDeleteDeck,
  reduceDeleteRecord,
  reduceDeleteRecords,
  reduceDeleteTag,
  reduceImportRecords,
  reduceRenameTag,
  reduceSetOverlayStats,
  reduceSetPanelDateFilter,
  reduceUpdateDeck,
  reduceUpdateRecord,
  type NewRecord,
  type RecordPatch,
} from "./reducer";

function loadStorage(): AppStorage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultStorage();
    return normalizeStorage(JSON.parse(raw));
  } catch {
    return createDefaultStorage();
  }
}

function saveStorage(state: AppStorage): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadDraftTurnOrder(): TurnOrder | null {
  const raw = localStorage.getItem(DRAFT_TURN_ORDER_KEY);
  return raw === "first" || raw === "second" || raw === "third" ? raw : null;
}

export interface BattlesStore {
  getState(): AppStorage;
  subscribe(listener: () => void): () => void;

  addRecord(payload: NewRecord): void;
  updateRecord(id: string, patch: RecordPatch): void;
  deleteRecord(id: string): void;
  deleteRecords(ids: string[]): void;
  importRecords(rows: CsvImportRow[]): { importedCount: number };

  addOwnDeck(name: string): Deck;
  updateOwnDeck(id: string, name: string): void;
  deleteOwnDeck(id: string): void;
  addOpponentDeck(name: string): Deck;
  updateOpponentDeck(id: string, name: string): void;
  deleteOpponentDeck(id: string): void;

  addTag(tag: string): void;
  renameTag(oldTag: string, newTag: string): void;
  deleteTag(tag: string): void;

  setOverlayStats(stats: OverlayStatSetting[]): void;
  setPanelDateFilter(filter: PanelDateFilter): void;

  getDraftTurnOrder(): TurnOrder | null;
  setDraftTurnOrder(value: TurnOrder | null): void;
}

export function createBattlesStore(): BattlesStore {
  let state: AppStorage = loadStorage();
  let draftTurnOrder: TurnOrder | null = loadDraftTurnOrder();
  const listeners = new Set<() => void>();

  function notify() {
    listeners.forEach((l) => l());
  }

  function commit(next: AppStorage) {
    if (next === state) return;
    state = next;
    saveStorage(state);
    notify();
  }

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY) {
        state = loadStorage();
        notify();
      } else if (e.key === DRAFT_TURN_ORDER_KEY) {
        draftTurnOrder = loadDraftTurnOrder();
        notify();
      }
    });
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    addRecord(payload) {
      commit(reduceAddRecord(state, payload));
    },
    updateRecord(id, patch) {
      commit(reduceUpdateRecord(state, id, patch));
    },
    deleteRecord(id) {
      commit(reduceDeleteRecord(state, id));
    },
    deleteRecords(ids) {
      commit(reduceDeleteRecords(state, ids));
    },
    importRecords(rows) {
      const { state: next, importedCount } = reduceImportRecords(state, rows);
      commit(next);
      return { importedCount };
    },

    addOwnDeck(name) {
      const { state: next, deck } = reduceAddDeck(state, "ownDecks", name);
      commit(next);
      return deck;
    },
    updateOwnDeck(id, name) {
      commit(reduceUpdateDeck(state, "ownDecks", id, name));
    },
    deleteOwnDeck(id) {
      commit(reduceDeleteDeck(state, "ownDecks", id));
    },
    addOpponentDeck(name) {
      const { state: next, deck } = reduceAddDeck(state, "opponentDecks", name);
      commit(next);
      return deck;
    },
    updateOpponentDeck(id, name) {
      commit(reduceUpdateDeck(state, "opponentDecks", id, name));
    },
    deleteOpponentDeck(id) {
      commit(reduceDeleteDeck(state, "opponentDecks", id));
    },

    addTag(tag) {
      commit(reduceAddTag(state, tag));
    },
    renameTag(oldTag, newTag) {
      commit(reduceRenameTag(state, oldTag, newTag));
    },
    deleteTag(tag) {
      commit(reduceDeleteTag(state, tag));
    },

    setOverlayStats(stats) {
      commit(reduceSetOverlayStats(state, stats));
    },
    setPanelDateFilter(filter) {
      commit(reduceSetPanelDateFilter(state, filter));
    },

    getDraftTurnOrder: () => draftTurnOrder,
    setDraftTurnOrder(value) {
      if (value === draftTurnOrder) return;
      draftTurnOrder = value;
      if (value === null) {
        localStorage.removeItem(DRAFT_TURN_ORDER_KEY);
      } else {
        localStorage.setItem(DRAFT_TURN_ORDER_KEY, value);
      }
      notify();
    },
  };
}
