import { useState, useMemo } from 'react';
import type { BattleRecord, BattleResult, TurnOrder } from '../types';

export interface FilterState {
  ownDeckId: string;
  opponentDeckId: string;
  result: BattleResult | '';
  turnOrder: TurnOrder | '';
  dateFrom: string;
  dateTo: string;
}

const DEFAULT_FILTER: FilterState = {
  ownDeckId: '',
  opponentDeckId: '',
  result: '',
  turnOrder: '',
  dateFrom: '',
  dateTo: '',
};

export function useFilter(records: BattleRecord[]) {
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (filter.ownDeckId && r.ownDeckId !== filter.ownDeckId) return false;
      if (filter.opponentDeckId && r.opponentDeckId !== filter.opponentDeckId) return false;
      if (filter.result && r.result !== filter.result) return false;
      if (filter.turnOrder && r.turnOrder !== filter.turnOrder) return false;
      if (filter.dateFrom && r.createdAt < filter.dateFrom) return false;
      if (filter.dateTo && r.createdAt > filter.dateTo + 'T23:59:59') return false;
      return true;
    });
  }, [records, filter]);

  const updateFilter = (patch: Partial<FilterState>) => {
    setFilter((prev) => ({ ...prev, ...patch }));
  };

  const resetFilter = () => setFilter(DEFAULT_FILTER);

  return { filter, filtered, updateFilter, resetFilter };
}
