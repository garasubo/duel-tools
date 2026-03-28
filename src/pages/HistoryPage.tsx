import { useBattlesContext } from '../context/BattlesContext';
import { useFilter } from '../hooks/useFilter';
import { useCsvExport } from '../hooks/useCsvExport';
import Button from '../components/ui/Button';
import FilterBar from '../components/history/FilterBar';
import RecordList from '../components/history/RecordList';

export default function HistoryPage() {
  const { records, ownDecks, opponentDecks } = useBattlesContext();
  const { filter, filtered, updateFilter, resetFilter } = useFilter(records);
  const { exportCsv } = useCsvExport();

  function handleExport() {
    exportCsv(filtered, ownDecks, opponentDecks);
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
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExport}
          disabled={filtered.length === 0}
        >
          CSVエクスポート
        </Button>
      </div>

      <RecordList records={filtered} />
    </div>
  );
}
