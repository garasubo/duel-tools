import { useRef, useState } from 'react';
import { useBattlesContext } from '../context/BattlesContext';
import { useFilter } from '../hooks/useFilter';
import { useCsvExport } from '../hooks/useCsvExport';
import { useCsvImport } from '../hooks/useCsvImport';
import Button from '../components/ui/Button';
import FilterBar from '../components/history/FilterBar';
import RecordList from '../components/history/RecordList';

export default function HistoryPage() {
  const { records, ownDecks, opponentDecks, deleteRecords } = useBattlesContext();
  const { filter, filtered, updateFilter, resetFilter } = useFilter(records);
  const { exportCsv } = useCsvExport();
  const { importCsv, status: importStatus, result: importResult, reset: resetImport } = useCsvImport();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function handleImportClick() {
    resetImport();
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    importCsv(file);
    // reset so the same file can be re-selected
    e.target.value = '';
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
          <Button
            variant="secondary"
            size="sm"
            onClick={handleImportClick}
          >
            CSVインポート
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {importStatus === 'success' && importResult && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
          {importResult.importedCount} 件インポートしました
          {importResult.errorCount > 0 && `（${importResult.errorCount} 行スキップ）`}
        </div>
      )}
      {importStatus === 'error' && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          インポートに失敗しました
          {importResult && importResult.errorCount > 0 && `（${importResult.errorCount} 行にエラーがあります）`}
        </div>
      )}

      <RecordList records={filtered} />
    </div>
  );
}
