import { useCallback } from "react";
import type { AppStorage, Deck } from "../types";
import {
  addDeckIfMissing,
  findDeckByName,
  normalizeDeckName,
} from "../utils/decks";
import type { AppStorageApi } from "./useAppStorage";

type DeckKey = "ownDecks" | "opponentDecks";

function useDeckActions(
  key: DeckKey,
  { storage, updateStorage }: AppStorageApi,
) {
  const add = useCallback(
    (name: string): Deck => {
      const normalizedName = normalizeDeckName(name);
      const existing = findDeckByName(storage[key], normalizedName);
      if (existing) return existing;

      const deck: Deck = { id: crypto.randomUUID(), name: normalizedName };
      updateStorage((prev: AppStorage) => {
        const next = addDeckIfMissing(prev[key], normalizedName, () => deck.id);
        if (!next.added) return prev;
        return { ...prev, [key]: next.decks };
      });
      return deck;
    },
    [key, storage, updateStorage],
  );

  const update = useCallback(
    (id: string, name: string) => {
      updateStorage((prev: AppStorage) => ({
        ...prev,
        [key]: prev[key].map((d) => (d.id === id ? { ...d, name } : d)),
      }));
    },
    [key, updateStorage],
  );

  const remove = useCallback(
    (id: string) => {
      updateStorage((prev: AppStorage) => ({
        ...prev,
        [key]: prev[key].filter((d) => d.id !== id),
      }));
    },
    [key, updateStorage],
  );

  return { add, update, remove };
}

export function useDeckManagement(api: AppStorageApi) {
  const { storage } = api;
  const own = useDeckActions("ownDecks", api);
  const opp = useDeckActions("opponentDecks", api);

  const isOwnDeckUsed = useCallback(
    (id: string) => storage.records.some((r) => r.ownDeckId === id),
    [storage.records],
  );

  const isOpponentDeckUsed = useCallback(
    (id: string) => storage.records.some((r) => r.opponentDeckId === id),
    [storage.records],
  );

  return {
    ownDecks: storage.ownDecks,
    opponentDecks: storage.opponentDecks,
    addOwnDeck: own.add,
    updateOwnDeck: own.update,
    deleteOwnDeck: own.remove,
    addOpponentDeck: opp.add,
    updateOpponentDeck: opp.update,
    deleteOpponentDeck: opp.remove,
    isOwnDeckUsed,
    isOpponentDeckUsed,
  };
}
