import type {
  AppStorage,
  BattleFormState,
  CaptureMemoShot,
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

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

interface CreateBattlesStoreOptions {
  storage?: StorageLike;
}

function getDefaultStorage(): StorageLike | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}

function loadStorage(storage: StorageLike | undefined): AppStorage {
  if (!storage) return createDefaultStorage();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultStorage();
    return normalizeStorage(JSON.parse(raw));
  } catch {
    return createDefaultStorage();
  }
}

function saveStorage(state: AppStorage, storage: StorageLike | undefined): void {
  storage?.setItem(STORAGE_KEY, JSON.stringify(state));
}

const EMPTY_DRAFT_BATTLE: DraftBattle = { turnOrder: null, result: null };

function loadDraftBattle(storage: StorageLike | undefined): DraftBattle {
  if (!storage) return EMPTY_DRAFT_BATTLE;
  try {
    const raw = storage.getItem(DRAFT_BATTLE_KEY);
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
  syncExternalStorageChange(key: string | null): void;

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

  // 記録タブの入力途中データ。タブ移動でコンポーネントが再マウントされても
  // 失わないようメモリ上に保持する（localStorage には永続化しない）。
  getDraftForm(): BattleFormState | null;
  setDraftForm(value: BattleFormState | null): void;
  getDraftMemoShots(): CaptureMemoShot[];
  setDraftMemoShots(value: CaptureMemoShot[]): void;
}

export function createBattlesStore(
  options: CreateBattlesStoreOptions = {},
): BattlesStore {
  const storage = options.storage ?? getDefaultStorage();
  let state: AppStorage = loadStorage(storage);
  let draftBattle: DraftBattle = loadDraftBattle(storage);
  let draftForm: BattleFormState | null = null;
  let draftMemoShots: CaptureMemoShot[] = [];
  const listeners = new Set<() => void>();

  function notify() {
    listeners.forEach((l) => l());
  }

  function commit(next: AppStorage) {
    if (next === state) return;
    saveStorage(next, storage);
    state = next;
    notify();
  }

  function persistDraftBattle(value: DraftBattle) {
    if (value.turnOrder === null && value.result === null) {
      storage?.removeItem(DRAFT_BATTLE_KEY);
    } else {
      storage?.setItem(DRAFT_BATTLE_KEY, JSON.stringify(value));
    }
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    syncExternalStorageChange(key) {
      if (!storage) return;
      let changed = false;
      if (key === STORAGE_KEY || key === null) {
        state = loadStorage(storage);
        changed = true;
      }
      if (key === DRAFT_BATTLE_KEY || key === null) {
        draftBattle = loadDraftBattle(storage);
        changed = true;
      }
      if (changed) notify();
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
      persistDraftBattle(value);
      draftBattle = value;
      notify();
    },

    getDraftForm: () => draftForm,
    setDraftForm(value) {
      draftForm = value;
    },
    getDraftMemoShots: () => draftMemoShots,
    setDraftMemoShots(value) {
      draftMemoShots = value;
    },
  };
}
