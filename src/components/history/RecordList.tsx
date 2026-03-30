import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { BattleRecord } from '../../types';
import { useBattlesContext } from '../../context/BattlesContext';
import EmptyState from '../ui/EmptyState';
import RecordTable from './RecordTable';
import RecordDetail from './RecordDetail';

export interface RecordListProps {
  records: BattleRecord[];
}

export default function RecordList({ records }: RecordListProps) {
  const { recordId } = useParams<{ recordId: string }>();
  const navigate = useNavigate();
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

  const selectedRecord = recordId
    ? (records.find((r) => r.id === recordId) ?? null)
    : null;

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
        onRowClick={(record) => navigate(`/record/history/${record.id}`)}
      />

      {selectedRecord !== null && (
        <RecordDetail
          record={selectedRecord}
          isOpen={true}
          onClose={() => navigate('/record/history')}
        />
      )}
    </>
  );
}
