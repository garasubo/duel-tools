import { useState, useCallback, useEffect } from "react";
import type {
  AppStorage,
  BattleRecord,
  Deck,
  OverlayStatSetting,
} from "../types";
import type { CsvImportRow } from "../utils/csvImportHelpers";
import { STORAGE_KEY } from "../utils/constants";
import { createDefaultStorage, normalizeStorage } from "../utils/storage";
import { isValidOverlayStatSettings } from "../utils/overlayStats";

const DEFAULT_STORAGE: AppStorage = createDefaultStorage();

function loadStorage(): AppStorage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STORAGE;
    return normalizeStorage(JSON.parse(raw));
  } catch {
    return DEFAULT_STORAGE;
  }
}

function saveStorage(storage: AppStorage): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
}

export function useBattles() {
  const [storage, setStorage] = useState<AppStorage>(loadStorage);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setStorage(loadStorage());
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const updateStorage = useCallback(
    (updater: (prev: AppStorage) => AppStorage) => {
      setStorage((prev) => {
        const next = updater(prev);
        saveStorage(next);
        return next;
      });
    },
    [],
  );

  // BattleRecord CRUD
  const addRecord = useCallback(
    (record: Omit<BattleRecord, "id" | "createdAt">) => {
      updateStorage((prev) => {
        const newRecord: BattleRecord = {
          ...record,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        const newTags = record.reasonTags.filter(
          (t) => !prev.knownTags.includes(t),
        );
        return {
          ...prev,
          records: [newRecord, ...prev.records],
          knownTags: [...prev.knownTags, ...newTags],
        };
      });
    },
    [updateStorage],
  );

  const updateRecord = useCallback(
    (id: string, patch: Partial<Omit<BattleRecord, "id" | "createdAt">>) => {
      updateStorage((prev) => ({
        ...prev,
        records: prev.records.map((r) =>
          r.id === id ? { ...r, ...patch } : r,
        ),
      }));
    },
    [updateStorage],
  );

  const deleteRecord = useCallback(
    (id: string) => {
      updateStorage((prev) => ({
        ...prev,
        records: prev.records.filter((r) => r.id !== id),
      }));
    },
    [updateStorage],
  );

  const deleteRecords = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      updateStorage((prev) => ({
        ...prev,
        records: prev.records.filter((r) => !idSet.has(r.id)),
      }));
    },
    [updateStorage],
  );

  // Own Deck CRUD
  const addOwnDeck = useCallback(
    (name: string): Deck => {
      const deck: Deck = { id: crypto.randomUUID(), name };
      updateStorage((prev) => ({
        ...prev,
        ownDecks: [...prev.ownDecks, deck],
      }));
      return deck;
    },
    [updateStorage],
  );

  const updateOwnDeck = useCallback(
    (id: string, name: string) => {
      updateStorage((prev) => ({
        ...prev,
        ownDecks: prev.ownDecks.map((d) => (d.id === id ? { ...d, name } : d)),
      }));
    },
    [updateStorage],
  );

  const deleteOwnDeck = useCallback(
    (id: string) => {
      updateStorage((prev) => ({
        ...prev,
        ownDecks: prev.ownDecks.filter((d) => d.id !== id),
      }));
    },
    [updateStorage],
  );

  // Opponent Deck CRUD
  const addOpponentDeck = useCallback(
    (name: string): Deck => {
      const deck: Deck = { id: crypto.randomUUID(), name };
      updateStorage((prev) => ({
        ...prev,
        opponentDecks: [...prev.opponentDecks, deck],
      }));
      return deck;
    },
    [updateStorage],
  );

  const updateOpponentDeck = useCallback(
    (id: string, name: string) => {
      updateStorage((prev) => ({
        ...prev,
        opponentDecks: prev.opponentDecks.map((d) =>
          d.id === id ? { ...d, name } : d,
        ),
      }));
    },
    [updateStorage],
  );

  const deleteOpponentDeck = useCallback(
    (id: string) => {
      updateStorage((prev) => ({
        ...prev,
        opponentDecks: prev.opponentDecks.filter((d) => d.id !== id),
      }));
    },
    [updateStorage],
  );

  // Tags
  const addKnownTag = useCallback(
    (tag: string) => {
      updateStorage((prev) => {
        if (prev.knownTags.includes(tag)) return prev;
        return { ...prev, knownTags: [...prev.knownTags, tag] };
      });
    },
    [updateStorage],
  );

  const updateKnownTag = useCallback(
    (oldTag: string, newTag: string) => {
      updateStorage((prev) => ({
        ...prev,
        knownTags: prev.knownTags.map((t) => (t === oldTag ? newTag : t)),
        records: prev.records.map((r) => ({
          ...r,
          reasonTags: r.reasonTags.map((t) => (t === oldTag ? newTag : t)),
        })),
      }));
    },
    [updateStorage],
  );

  const deleteKnownTag = useCallback(
    (tag: string) => {
      updateStorage((prev) => ({
        ...prev,
        knownTags: prev.knownTags.filter((t) => t !== tag),
        records: prev.records.map((r) => ({
          ...r,
          reasonTags: r.reasonTags.filter((t) => t !== tag),
        })),
      }));
    },
    [updateStorage],
  );

  const importRecords = useCallback(
    (rows: CsvImportRow[]): { importedCount: number } => {
      let importedCount = 0;
      updateStorage((prev) => {
        const ownDeckMap = new Map(prev.ownDecks.map((d) => [d.name, d.id]));
        const oppDeckMap = new Map(
          prev.opponentDecks.map((d) => [d.name, d.id]),
        );
        const newOwnDecks: Deck[] = [];
        const newOppDecks: Deck[] = [];
        const newTags: string[] = [];
        const newRecords: BattleRecord[] = [];

        for (const row of rows) {
          // 自分のデッキ解決
          let ownDeckId = ownDeckMap.get(row.ownDeckName);
          if (!ownDeckId) {
            const deck: Deck = {
              id: crypto.randomUUID(),
              name: row.ownDeckName,
            };
            newOwnDecks.push(deck);
            ownDeckMap.set(deck.name, deck.id);
            ownDeckId = deck.id;
          }

          // 相手のデッキ解決（空文字 = 不明）
          let opponentDeckId = "";
          if (row.opponentDeckName !== "") {
            const found = oppDeckMap.get(row.opponentDeckName);
            if (found) {
              opponentDeckId = found;
            } else {
              const deck: Deck = {
                id: crypto.randomUUID(),
                name: row.opponentDeckName,
              };
              newOppDecks.push(deck);
              oppDeckMap.set(deck.name, deck.id);
              opponentDeckId = deck.id;
            }
          }

          // 新規タグ収集
          for (const tag of row.reasonTags) {
            if (!prev.knownTags.includes(tag) && !newTags.includes(tag)) {
              newTags.push(tag);
            }
          }

          const record: BattleRecord = {
            id: crypto.randomUUID(),
            createdAt: row.createdAt,
            ownDeckId,
            opponentDeckId,
            result: row.result,
            turnOrder: row.turnOrder,
            ...(row.battleMode !== undefined
              ? { battleMode: row.battleMode }
              : {}),
            ...(row.score !== undefined ? { score: row.score } : {}),
            reasonTags: row.reasonTags,
            memo: row.memo,
          };
          newRecords.push(record);
        }

        importedCount = newRecords.length;
        return {
          ...prev,
          records: [...newRecords, ...prev.records],
          ownDecks: [...prev.ownDecks, ...newOwnDecks],
          opponentDecks: [...prev.opponentDecks, ...newOppDecks],
          knownTags: [...prev.knownTags, ...newTags],
        };
      });
      return { importedCount };
    },
    [updateStorage],
  );

  const isOwnDeckUsed = useCallback(
    (id: string) => storage.records.some((r) => r.ownDeckId === id),
    [storage],
  );

  const isOpponentDeckUsed = useCallback(
    (id: string) => storage.records.some((r) => r.opponentDeckId === id),
    [storage],
  );

  const isTagUsed = useCallback(
    (tag: string) => storage.records.some((r) => r.reasonTags.includes(tag)),
    [storage],
  );

  const setOverlayStatSettings = useCallback(
    (overlayStats: OverlayStatSetting[]) => {
      if (!isValidOverlayStatSettings(overlayStats)) {
        throw new Error("Invalid overlay stat settings");
      }

      updateStorage((prev) => ({
        ...prev,
        overlayStats,
      }));
    },
    [updateStorage],
  );

  return {
    records: storage.records,
    ownDecks: storage.ownDecks,
    opponentDecks: storage.opponentDecks,
    knownTags: storage.knownTags,
    overlayStatSettings: storage.overlayStats,
    addRecord,
    importRecords,
    updateRecord,
    deleteRecord,
    deleteRecords,
    addOwnDeck,
    updateOwnDeck,
    deleteOwnDeck,
    addOpponentDeck,
    updateOpponentDeck,
    deleteOpponentDeck,
    addKnownTag,
    updateKnownTag,
    deleteKnownTag,
    isOwnDeckUsed,
    isOpponentDeckUsed,
    isTagUsed,
    setOverlayStatSettings,
  };
}
