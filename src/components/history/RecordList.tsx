import { useMemo, useState } from 'react';
import type { BattleRecord } from '../../types';
import { useBattlesContext } from '../../context/BattlesContext';
import EmptyState from '../ui/EmptyState';
import RecordTable from './RecordTable';
import RecordDetail from './RecordDetail';

export interface RecordListProps {
  records: BattleRecord[];
}

export default function RecordList({ records }: RecordListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { ownDecks, opponentDecks } = useBattlesContext();

  const ownDeckMap = useMemo(
    () => new Map(ownDecks.map((d) => [d.id, d.name])),
    [ownDecks],
  );
  const opponentDeckMap = useMemo(
    () => new Map(opponentDecks.map((d) => [d.id, d.name])),
    [opponentDecks],
  );

  const sorted = [...records].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const selectedRecord = selectedId ? (records.find((r) => r.id === selectedId) ?? null) : null;

  if (sorted.length === 0) {
    return (
      <EmptyState
        title="戦績がありません"
        description="条件に一致する戦績が見つかりませんでした。"
      />
    );
  }

  return (
    <>
      <RecordTable
        records={sorted}
        ownDeckMap={ownDeckMap}
        opponentDeckMap={opponentDeckMap}
        onRowClick={(record) => setSelectedId(record.id)}
      />

      {selectedRecord !== null && (
        <RecordDetail
          record={selectedRecord}
          isOpen={true}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}
