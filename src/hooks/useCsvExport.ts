import { useCallback } from 'react';
import type { BattleRecord, Deck } from '../types';
import { buildCsvString } from '../utils/csvHelpers';

export function useCsvExport() {
  const exportCsv = useCallback(
    (records: BattleRecord[], ownDecks: Deck[], opponentDecks: Deck[]) => {
      const csv = buildCsvString(records, ownDecks, opponentDecks);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `duel-records-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [],
  );

  return { exportCsv };
}
