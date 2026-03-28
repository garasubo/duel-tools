import { useMemo } from 'react';
import type { BattleRecord, Deck } from '../types';

export interface WinLossDraw {
  win: number;
  loss: number;
  draw: number;
  total: number;
  winRate: number; // 0〜1
}

export interface DeckStat {
  deckId: string;
  deckName: string;
  overall: WinLossDraw;
  asFirst: WinLossDraw;
  asSecond: WinLossDraw;
}

export interface MatchupCell {
  ownDeckId: string;
  opponentDeckId: string;
  stats: WinLossDraw;
}

export function calcWLD(records: BattleRecord[]): WinLossDraw {
  const win = records.filter((r) => r.result === 'win').length;
  const loss = records.filter((r) => r.result === 'loss').length;
  const draw = records.filter((r) => r.result === 'draw').length;
  const total = records.length;
  const winRate = total > 0 ? win / total : 0;
  return { win, loss, draw, total, winRate };
}

export function useStats(records: BattleRecord[], ownDecks: Deck[], opponentDecks: Deck[]) {
  const overall = useMemo(() => calcWLD(records), [records]);

  const asFirst = useMemo(
    () => calcWLD(records.filter((r) => r.turnOrder === 'first')),
    [records],
  );

  const asSecond = useMemo(
    () => calcWLD(records.filter((r) => r.turnOrder === 'second')),
    [records],
  );

  const deckStats = useMemo((): DeckStat[] => {
    return ownDecks.map((deck) => {
      const deckRecords = records.filter((r) => r.ownDeckId === deck.id);
      return {
        deckId: deck.id,
        deckName: deck.name,
        overall: calcWLD(deckRecords),
        asFirst: calcWLD(deckRecords.filter((r) => r.turnOrder === 'first')),
        asSecond: calcWLD(deckRecords.filter((r) => r.turnOrder === 'second')),
      };
    });
  }, [records, ownDecks]);

  const matchupCells = useMemo((): MatchupCell[] => {
    const cells: MatchupCell[] = [];
    for (const own of ownDecks) {
      for (const opp of opponentDecks) {
        const matchRecords = records.filter(
          (r) => r.ownDeckId === own.id && r.opponentDeckId === opp.id,
        );
        if (matchRecords.length > 0) {
          cells.push({
            ownDeckId: own.id,
            opponentDeckId: opp.id,
            stats: calcWLD(matchRecords),
          });
        }
      }
    }
    return cells;
  }, [records, ownDecks, opponentDecks]);

  return { overall, asFirst, asSecond, deckStats, matchupCells };
}
