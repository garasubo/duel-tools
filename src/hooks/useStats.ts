import { useMemo } from 'react';
import type { BattleRecord, Deck, DraftBattle, TurnOrder } from '../types';

export interface WinLoss {
  win: number;
  loss: number;
  total: number;
  winRate: number; // 0〜1
}

// 勝敗の内訳。先攻/後攻（手番）とコイン表/裏（コイントスの勝敗）の2系統を持つ。
// - asFirst/asSecond: ゆずられ先攻は includeGrantedFirst が true のときだけ先攻に含める（後攻には含めない）
// - coinHeads/coinTails: コイントスで先攻を取れた試合（first）が表、それ以外（second/third）が裏
export interface WinLossBreakdown {
  asFirst: WinLoss;
  asSecond: WinLoss;
  coinHeads: WinLoss;
  coinTails: WinLoss;
}

export type StatsSplitMode = 'coin' | 'turn';

export interface DeckStat extends WinLossBreakdown {
  deckId: string;
  deckName: string;
  overall: WinLoss;
}

export interface MatchupCell {
  ownDeckId: string;
  opponentDeckId: string;
  stats: WinLoss;
}

export interface OpponentDeckStat extends WinLossBreakdown {
  deckId: string; // '' = 不明
  deckName: string; // '不明' を含む
  overall: WinLoss;
}

export function calcWLD(records: BattleRecord[]): WinLoss {
  const win = records.filter((r) => r.result === 'win').length;
  const loss = records.filter((r) => r.result === 'loss').length;
  const total = records.length;
  const winRate = total > 0 ? win / total : 0;
  return { win, loss, total, winRate };
}

function isCountedAsFirst(turnOrder: TurnOrder, includeGrantedFirst: boolean): boolean {
  return turnOrder === 'first' || (includeGrantedFirst && turnOrder === 'third');
}

export function calcBreakdown(
  records: BattleRecord[],
  includeGrantedFirst = false,
): WinLossBreakdown {
  return {
    asFirst: calcWLD(records.filter((r) => isCountedAsFirst(r.turnOrder, includeGrantedFirst))),
    asSecond: calcWLD(records.filter((r) => r.turnOrder === 'second')),
    coinHeads: calcWLD(records.filter((r) => isCoinTossWin(r.turnOrder))),
    coinTails: calcWLD(records.filter((r) => !isCoinTossWin(r.turnOrder))),
  };
}

// 相手デッキ単位で勝率を集計する。
// - opponentDecks に登録されていない id（空文字 or 削除済み）はすべて「不明」バケットへ集約する。
// - 先攻/後攻の振り分けは deckStats と同一ロジック（includeGrantedFirst を尊重）。
// - 試合数の降順（頻度順）でソートする。ただし「不明」は頻度に関わらず常に最下部に置く。0件のデッキは含めない。
export function computeOpponentDeckStats(
  records: BattleRecord[],
  opponentDecks: Deck[],
  includeGrantedFirst = false,
): OpponentDeckStat[] {
  const knownIds = new Set(opponentDecks.map((d) => d.id));
  const groups = new Map<string, BattleRecord[]>();
  for (const r of records) {
    const key = knownIds.has(r.opponentDeckId) ? r.opponentDeckId : '';
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(r);
    } else {
      groups.set(key, [r]);
    }
  }

  const stats: OpponentDeckStat[] = [];
  for (const [deckId, recs] of groups) {
    const deckName =
      deckId === '' ? '不明' : (opponentDecks.find((d) => d.id === deckId)?.name ?? '不明');
    stats.push({
      deckId,
      deckName,
      overall: calcWLD(recs),
      ...calcBreakdown(recs, includeGrantedFirst),
    });
  }

  stats.sort((a, b) => {
    // 「不明」は頻度に関わらず常に最下部
    if (a.deckId === '') return 1;
    if (b.deckId === '') return -1;
    return b.overall.total - a.overall.total;
  });
  return stats;
}

// コイントスは「先攻を取れたか」で勝敗を分類する（先攻=win、後攻/ゆずられ先攻=loss）。
export function isCoinTossWin(turnOrder: TurnOrder): boolean {
  return turnOrder === 'first';
}

// 集計値に1件（win または loss）を加えて再計算する。
function addToWinLoss(base: WinLoss, isWin: boolean): WinLoss {
  const win = base.win + (isWin ? 1 : 0);
  const loss = base.loss + (isWin ? 0 : 1);
  const total = win + loss;
  return { win, loss, total, winRate: total > 0 ? win / total : 0 };
}

export interface OverlayStatsValues {
  matchCount: number;
  overall: WinLoss;
  asFirst: WinLoss;
  asSecond: WinLoss;
  coinHeads: WinLoss;
  coinTails: WinLoss;
  coinToss: WinLoss;
}

// 確定済み（保存済み）の集計値に、入力途中（未保存）の一戦を「決まっている項目だけ」加える。
// - turnOrder が決まればコイン勝率に、result が決まれば全体/先攻/後攻/コイン表/コイン裏に反映する。
// - 試合数は対戦が進行中（turnOrder か result のどちらかが入力済み）なら +1。
export function applyDraftToOverlayStats(
  confirmedCount: number,
  stats: Omit<OverlayStatsValues, 'matchCount'>,
  draft: DraftBattle,
  includeGrantedFirst = false,
): OverlayStatsValues {
  let { overall, asFirst, asSecond, coinHeads, coinTails, coinToss } = stats;
  const active = draft.turnOrder !== null || draft.result !== null;

  if (draft.turnOrder) {
    coinToss = addToWinLoss(coinToss, isCoinTossWin(draft.turnOrder));
  }
  if (draft.result) {
    const isWin = draft.result === 'win';
    overall = addToWinLoss(overall, isWin);
    if (draft.turnOrder && isCountedAsFirst(draft.turnOrder, includeGrantedFirst)) {
      asFirst = addToWinLoss(asFirst, isWin);
    } else if (draft.turnOrder === 'second') {
      asSecond = addToWinLoss(asSecond, isWin);
    }
    if (draft.turnOrder) {
      if (isCoinTossWin(draft.turnOrder)) {
        coinHeads = addToWinLoss(coinHeads, isWin);
      } else {
        coinTails = addToWinLoss(coinTails, isWin);
      }
    }
  }

  return {
    matchCount: confirmedCount + (active ? 1 : 0),
    overall,
    asFirst,
    asSecond,
    coinHeads,
    coinTails,
    coinToss,
  };
}

export function useStats(
  records: BattleRecord[],
  ownDecks: Deck[],
  opponentDecks: Deck[],
  includeGrantedFirst = false,
) {
  const overall = useMemo(() => calcWLD(records), [records]);

  const breakdown = useMemo(
    () => calcBreakdown(records, includeGrantedFirst),
    [records, includeGrantedFirst],
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
        ...calcBreakdown(deckRecords, includeGrantedFirst),
      };
    });
  }, [records, ownDecks, includeGrantedFirst]);

  const opponentDeckStats = useMemo(
    () => computeOpponentDeckStats(records, opponentDecks, includeGrantedFirst),
    [records, opponentDecks, includeGrantedFirst],
  );

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

  return {
    overall,
    ...breakdown,
    breakdown,
    coinToss,
    deckStats,
    opponentDeckStats,
    matchupCells,
  };
}
