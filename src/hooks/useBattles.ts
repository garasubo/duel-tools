import { useState, useCallback, useEffect } from 'react';
import type { AppStorage, BattleRecord, Deck } from '../types';
import { STORAGE_KEY } from '../utils/constants';

const DEFAULT_STORAGE: AppStorage = {
  records: [],
  ownDecks: [],
  opponentDecks: [],
  knownTags: [],
};

function loadStorage(): AppStorage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STORAGE;
    return { ...DEFAULT_STORAGE, ...JSON.parse(raw) };
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
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const updateStorage = useCallback((updater: (prev: AppStorage) => AppStorage) => {
    setStorage((prev) => {
      const next = updater(prev);
      saveStorage(next);
      return next;
    });
  }, []);

  // BattleRecord CRUD
  const addRecord = useCallback(
    (record: Omit<BattleRecord, 'id' | 'createdAt'>) => {
      updateStorage((prev) => {
        const newRecord: BattleRecord = {
          ...record,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        const newTags = record.reasonTags.filter((t) => !prev.knownTags.includes(t));
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
    (id: string, patch: Partial<Omit<BattleRecord, 'id' | 'createdAt'>>) => {
      updateStorage((prev) => ({
        ...prev,
        records: prev.records.map((r) => (r.id === id ? { ...r, ...patch } : r)),
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

  // Own Deck CRUD
  const addOwnDeck = useCallback(
    (name: string): Deck => {
      const deck: Deck = { id: crypto.randomUUID(), name };
      updateStorage((prev) => ({ ...prev, ownDecks: [...prev.ownDecks, deck] }));
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
      updateStorage((prev) => ({ ...prev, opponentDecks: [...prev.opponentDecks, deck] }));
      return deck;
    },
    [updateStorage],
  );

  const updateOpponentDeck = useCallback(
    (id: string, name: string) => {
      updateStorage((prev) => ({
        ...prev,
        opponentDecks: prev.opponentDecks.map((d) => (d.id === id ? { ...d, name } : d)),
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

  return {
    records: storage.records,
    ownDecks: storage.ownDecks,
    opponentDecks: storage.opponentDecks,
    knownTags: storage.knownTags,
    addRecord,
    updateRecord,
    deleteRecord,
    addOwnDeck,
    updateOwnDeck,
    deleteOwnDeck,
    addOpponentDeck,
    updateOpponentDeck,
    deleteOpponentDeck,
    addKnownTag,
  };
}
