import { useMemo } from 'react';
import type { BattleRecord, Deck, TurnOrder } from '../types';

export interface WinLoss {
  win: number;
  loss: number;
  total: number;
  winRate: number; // 0〜1
}

export interface DeckStat {
  deckId: string;
  deckName: string;
  overall: WinLoss;
  asFirst: WinLoss;
  asSecond: WinLoss;
}

export interface MatchupCell {
  ownDeckId: string;
  opponentDeckId: string;
  stats: WinLoss;
}

export function calcWLD(records: BattleRecord[]): WinLoss {
  const win = records.filter((r) => r.result === 'win').length;
  const loss = records.filter((r) => r.result === 'loss').length;
  const total = records.length;
  const winRate = total > 0 ? win / total : 0;
  return { win, loss, total, winRate };
}

// コイントスは「先攻を取れたか」で勝敗を分類する（先攻=win、後攻/ゆずられ先攻=loss）。
export function isCoinTossWin(turnOrder: TurnOrder): boolean {
  return turnOrder === 'first';
}

// 確定済みの集計値に、入力途中（未保存）の一戦のコイントス結果だけを加える。
// 勝敗が絡む割合（全体/先攻/後攻）には影響させず、試合数とコイン勝率のみを更新する。
export function applyDraftToOverlayStats(
  confirmedCount: number,
  coinToss: WinLoss,
  draftTurnOrder: TurnOrder | null,
): { matchCount: number; coinToss: WinLoss } {
  if (!draftTurnOrder) return { matchCount: confirmedCount, coinToss };
  const draftWin = isCoinTossWin(draftTurnOrder);
  const win = coinToss.win + (draftWin ? 1 : 0);
  const loss = coinToss.loss + (draftWin ? 0 : 1);
  const total = win + loss;
  return {
    matchCount: confirmedCount + 1,
    coinToss: { win, loss, total, winRate: total > 0 ? win / total : 0 },
  };
}

export function useStats(
  records: BattleRecord[],
  ownDecks: Deck[],
  opponentDecks: Deck[],
  includeGrantedFirst = false,
) {
  const overall = useMemo(() => calcWLD(records), [records]);

  const asFirst = useMemo(
    () =>
      calcWLD(
        records.filter(
          (r) => r.turnOrder === 'first' || (includeGrantedFirst && r.turnOrder === 'third'),
        ),
      ),
    [records, includeGrantedFirst],
  );

  const asSecond = useMemo(
    () => calcWLD(records.filter((r) => r.turnOrder === 'second')),
    [records],
  );

  const coinToss = useMemo((): WinLoss => {
    const win = records.filter((r) => isCoinTossWin(r.turnOrder)).length;
    const loss = records.length - win;
    const total = records.length;
    return { win, loss, total, winRate: total > 0 ? win / total : 0 };
  }, [records]);

  const deckStats = useMemo((): DeckStat[] => {
    return ownDecks.map((deck) => {
      const deckRecords = records.filter((r) => r.ownDeckId === deck.id);
      return {
        deckId: deck.id,
        deckName: deck.name,
        overall: calcWLD(deckRecords),
        asFirst: calcWLD(
          deckRecords.filter(
            (r) => r.turnOrder === 'first' || (includeGrantedFirst && r.turnOrder === 'third'),
          ),
        ),
        asSecond: calcWLD(deckRecords.filter((r) => r.turnOrder === 'second')),
      };
    });
  }, [records, ownDecks, includeGrantedFirst]);

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

  return { overall, asFirst, asSecond, coinToss, deckStats, matchupCells };
}
