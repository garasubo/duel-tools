import { useState, useMemo } from 'react';
import type { BattleRecord, BattleResult, TurnOrder } from '../types';
import { isWithinDateRange } from '../utils/dateRange';
import { isCoinTossWin } from './useStats';

// コイン表 = コイントスで先攻を取れた（first）、コイン裏 = それ以外（second / third）
export type CoinTossFilter = 'heads' | 'tails';

export interface FilterState {
  ownDeckId: string;
  opponentDeckId: string;
  result: BattleResult | '';
  turnOrder: TurnOrder | '';
  coinToss: CoinTossFilter | '';
  dateFrom: string;
  dateTo: string;
}

const DEFAULT_FILTER: FilterState = {
  ownDeckId: '',
  opponentDeckId: '',
  result: '',
  turnOrder: '',
  coinToss: '',
  dateFrom: '',
  dateTo: '',
};

export function matchesFilter(r: BattleRecord, filter: FilterState): boolean {
  if (filter.ownDeckId && r.ownDeckId !== filter.ownDeckId) return false;
  if (filter.opponentDeckId && r.opponentDeckId !== filter.opponentDeckId) return false;
  if (filter.result && r.result !== filter.result) return false;
  if (filter.turnOrder && r.turnOrder !== filter.turnOrder) return false;
  if (filter.coinToss && isCoinTossWin(r.turnOrder) !== (filter.coinToss === 'heads')) {
    return false;
  }
  if (!isWithinDateRange(r.createdAt, filter.dateFrom, filter.dateTo)) return false;
  return true;
}

export function useFilter(records: BattleRecord[]) {
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);

  const filtered = useMemo(() => {
    return records.filter((r) => matchesFilter(r, filter));
  }, [records, filter]);

  const updateFilter = (patch: Partial<FilterState>) => {
    setFilter((prev) => ({ ...prev, ...patch }));
  };

  const resetFilter = () => setFilter(DEFAULT_FILTER);

  return { filter, filtered, updateFilter, resetFilter };
}
