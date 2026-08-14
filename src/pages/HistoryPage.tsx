import { useRef, useState } from 'react';
import { useRecords } from '../state/hooks/useRecords';
import { useOwnDecks } from '../state/hooks/useOwnDecks';
import { useOpponentDecks } from '../state/hooks/useOpponentDecks';
import { useFilter } from '../hooks/useFilter';
import { useCsvExport } from '../hooks/useCsvExport';
import { useCsvImport } from '../hooks/useCsvImport';
import { useXlsxExport } from '../hooks/useXlsxExport';
import { usePublishShare } from '../hooks/usePublishShare';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import FilterBar from '../components/history/FilterBar';
import RecordList from '../components/history/RecordList';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { SHARE_TITLE_MAX_LENGTH } from '../utils/constants';

export default function HistoryPage() {
  useDocumentTitle('対戦履歴 | 戦績記録 - duel-tools');
  const { items: records, removeMany } = useRecords();
  const { items: ownDecks } = useOwnDecks();
  const { items: opponentDecks } = useOpponentDecks();
  const { filter, filtered, updateFilter, resetFilter } = useFilter(records);
  const { exportCsv } = useCsvExport();
  const { importCsv, status: importStatus, result: importResult, reset: resetImport } = useCsvImport();
  const { publish, status: publishStatus, shareUrl, reset: resetPublish } = usePublishShare();
  const { exportXlsx, status: xlsxStatus, reset: resetXlsx } = useXlsxExport();
  const [xlsxModalOpen, setXlsxModalOpen] = useState(false);
  const [xlsxRange, setXlsxRange] = useState<'filtered' | 'all'>('filtered');
  const [xlsxIncludeGrantedFirst, setXlsxIncludeGrantedFirst] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTitle, setShareTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const xlsxRecords = xlsxRange === 'all' ? records : filtered;

  function handleExport() {
    exportCsv(filtered, ownDecks, opponentDecks);
  }

  function handleOpenXlsx() {
    resetXlsx();
    // 絞り込み結果が0件なら全記録を初期選択にする。
    setXlsxRange(filtered.length > 0 ? 'filtered' : 'all');
    setXlsxModalOpen(true);
  }

  function handleCloseXlsx() {
    if (xlsxStatus === 'loading') return;
    setXlsxModalOpen(false);
    resetXlsx();
  }

  async function handleXlsxExport() {
    const ok = await exportXlsx(xlsxRecords, ownDecks, opponentDecks, {
      rangeLabel:
        xlsxRange === 'all'
          ? `全記録（${records.length}件）`
          : `絞り込み結果（${filtered.length}件）`,
      includeGrantedFirst: xlsxIncludeGrantedFirst,
    });
    if (ok) setXlsxModalOpen(false);
  }

  function handleDeleteAll() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    removeMany(filtered.map((r) => r.id));
    setConfirmingDelete(false);
  }

  function handleImportClick() {
    resetImport();
    fileInputRef.current?.click();
  }

  function handleOpenShare() {
    resetPublish();
    setCopied(false);
    setShareTitle('');
    setShareModalOpen(true);
  }

  function handleShare() {
    setCopied(false);
    void publish(shareTitle);
  }

  function handleCloseShare() {
    setShareModalOpen(false);
    resetPublish();
    setCopied(false);
    setShareTitle('');
  }

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
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
            onClick={handleOpenXlsx}
            disabled={records.length === 0}
          >
            Excelエクスポート
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleImportClick}
          >
            CSVインポート
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenShare}
            disabled={records.length === 0}
          >
            共有リンクを作成
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

      <Modal
        isOpen={xlsxModalOpen}
        onClose={handleCloseXlsx}
        title="Excelエクスポート"
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-600">
            戦績と統計をまとめた Excel ファイル（.xlsx）を書き出します。
          </p>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-gray-700 mb-1">
              出力範囲
            </legend>
            <label className="flex items-center gap-2 text-sm text-gray-700 select-none cursor-pointer">
              <input
                type="radio"
                name="xlsx-range"
                checked={xlsxRange === 'filtered'}
                disabled={filtered.length === 0 || xlsxStatus === 'loading'}
                onChange={() => setXlsxRange('filtered')}
                className="w-4 h-4 accent-brand-action"
              />
              絞り込み結果（{filtered.length}件）
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 select-none cursor-pointer">
              <input
                type="radio"
                name="xlsx-range"
                checked={xlsxRange === 'all'}
                disabled={xlsxStatus === 'loading'}
                onChange={() => setXlsxRange('all')}
                className="w-4 h-4 accent-brand-action"
              />
              全記録（{records.length}件）
            </label>
          </fieldset>

          <label className="flex items-center gap-2 text-sm text-gray-600 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={xlsxIncludeGrantedFirst}
              disabled={xlsxStatus === 'loading'}
              onChange={(e) => setXlsxIncludeGrantedFirst(e.target.checked)}
              className="w-4 h-4 accent-brand-action"
            />
            ゆずられ先攻を先攻に含める（統計シート）
          </label>

          {xlsxStatus === 'loading' && (
            <p className="text-sm text-gray-600">
              Excel ファイルを作成しています...
            </p>
          )}
          {xlsxStatus === 'error' && (
            <p className="text-sm text-red-700">
              Excel ファイルの作成に失敗しました。時間をおいて再度お試しください。
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCloseXlsx}
              disabled={xlsxStatus === 'loading'}
            >
              キャンセル
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                void handleXlsxExport();
              }}
              disabled={xlsxStatus === 'loading' || xlsxRecords.length === 0}
            >
              {xlsxStatus === 'loading' ? '作成中...' : 'ダウンロード'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={shareModalOpen}
        onClose={handleCloseShare}
        title="共有リンク"
      >
        {publishStatus === 'idle' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-600">
              現在の<strong>全記録</strong>を読み取り専用で公開します。
            </p>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="share-title"
                className="text-sm font-medium text-gray-700"
              >
                タイトル（任意）
              </label>
              <input
                id="share-title"
                type="text"
                value={shareTitle}
                maxLength={SHARE_TITLE_MAX_LENGTH}
                onChange={(e) => setShareTitle(e.target.value)}
                placeholder="例: 7月ランク戦の戦績"
                className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-800"
              />
              <span className="text-xs text-gray-400">
                共有ページの見出しに表示されます（{SHARE_TITLE_MAX_LENGTH}文字まで）。
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={handleCloseShare}>
                キャンセル
              </Button>
              <Button variant="primary" size="sm" onClick={handleShare}>
                共有リンクを作成
              </Button>
            </div>
          </div>
        )}
        {publishStatus === 'loading' && (
          <p className="text-sm text-gray-600">共有リンクを作成しています...</p>
        )}
        {publishStatus === 'error' && (
          <p className="text-sm text-red-700">
            共有リンクの作成に失敗しました。時間をおいて再度お試しください。
          </p>
        )}
        {publishStatus === 'success' && shareUrl && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-600">
              現在の<strong>全記録</strong>を読み取り専用で公開しました。このリンクを知っている人が閲覧できます。
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                onFocus={(e) => e.target.select()}
                className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm bg-gray-50 text-gray-800"
              />
              <Button variant="secondary" size="sm" onClick={handleCopy}>
                {copied ? 'コピーしました' : 'コピー'}
              </Button>
            </div>
            <p className="text-xs text-gray-400">
              公開後の内容は固定されます。更新したい場合は再度リンクを作成してください。
            </p>
          </div>
        )}
      </Modal>

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
