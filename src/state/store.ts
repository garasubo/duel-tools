import type {
  AppStorage,
  Deck,
  DraftBattle,
  OverlayStatSetting,
  PanelDateFilter,
} from "../types";
import { DRAFT_BATTLE_KEY, STORAGE_KEY } from "../utils/constants";
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

const EMPTY_DRAFT_BATTLE: DraftBattle = { turnOrder: null, result: null };

function loadDraftBattle(): DraftBattle {
  try {
    const raw = localStorage.getItem(DRAFT_BATTLE_KEY);
    if (!raw) return EMPTY_DRAFT_BATTLE;
    const parsed = JSON.parse(raw) as Partial<DraftBattle>;
    const turnOrder = parsed?.turnOrder;
    const result = parsed?.result;
    return {
      turnOrder:
        turnOrder === "first" || turnOrder === "second" || turnOrder === "third"
          ? turnOrder
          : null,
      result: result === "win" || result === "loss" ? result : null,
    };
  } catch {
    return EMPTY_DRAFT_BATTLE;
  }
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

  getDraftBattle(): DraftBattle;
  setDraftBattle(value: DraftBattle): void;
}

export function createBattlesStore(): BattlesStore {
  let state: AppStorage = loadStorage();
  let draftBattle: DraftBattle = loadDraftBattle();
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
      } else if (e.key === DRAFT_BATTLE_KEY) {
        draftBattle = loadDraftBattle();
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

    getDraftBattle: () => draftBattle,
    setDraftBattle(value) {
      if (
        value.turnOrder === draftBattle.turnOrder &&
        value.result === draftBattle.result
      ) {
        return;
      }
      draftBattle = value;
      if (value.turnOrder === null && value.result === null) {
        localStorage.removeItem(DRAFT_BATTLE_KEY);
      } else {
        localStorage.setItem(DRAFT_BATTLE_KEY, JSON.stringify(value));
      }
      notify();
    },
  };
}
