import { useCallback } from "react";
import type { BattleRecord, Deck } from "../types";
import type { CsvImportRow } from "../utils/csvImportHelpers";
import type { AppStorageApi } from "./useAppStorage";

export function useBattleRecords({ storage, updateStorage }: AppStorageApi) {
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

  return {
    records: storage.records,
    addRecord,
    updateRecord,
    deleteRecord,
    deleteRecords,
    importRecords,
  };
}
