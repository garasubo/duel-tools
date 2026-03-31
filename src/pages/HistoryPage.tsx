import { useState } from 'react';
import { useBattlesContext } from '../context/BattlesContext';
import { useFilter } from '../hooks/useFilter';
import { useCsvExport } from '../hooks/useCsvExport';
import Button from '../components/ui/Button';
import FilterBar from '../components/history/FilterBar';
import RecordList from '../components/history/RecordList';

export default function HistoryPage() {
  const { records, ownDecks, opponentDecks, deleteRecords } = useBattlesContext();
  const { filter, filtered, updateFilter, resetFilter } = useFilter(records);
  const { exportCsv } = useCsvExport();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function handleExport() {
    exportCsv(filtered, ownDecks, opponentDecks);
  }

  function handleDeleteAll() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    deleteRecords(filtered.map((r) => r.id));
    setConfirmingDelete(false);
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-5xl mx-auto">
      <FilterBar
        filter={filter}
        onChange={updateFilter}
        onReset={resetFilter}
        ownDecks={ownDecks}
        opponentDecks={opponentDecks}
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">
          {filtered.length} 件
        </span>
        <div className="flex items-center gap-2">
          {confirmingDelete && (
            <span className="text-sm text-red-600">
              {filtered.length} 件を削除しますか？
            </span>
          )}
          {confirmingDelete && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setConfirmingDelete(false)}
            >
              キャンセル
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            onClick={handleDeleteAll}
            disabled={filtered.length === 0}
          >
            {confirmingDelete ? '削除する' : '一斉削除'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExport}
            disabled={filtered.length === 0}
          >
            CSVエクスポート
          </Button>
        </div>
      </div>

      <RecordList records={filtered} />
    </div>
  );
}
