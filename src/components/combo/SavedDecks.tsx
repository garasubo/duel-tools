import { useRef, useState } from 'react';
import type { SavedDeck } from '../../utils/comboDeckStorage';
import { downloadDeckFile, parseDeckFile, type DeckFileData } from '../../utils/comboDeckFile';
import Button from '../ui/Button';

export interface SavedDecksProps {
  savedDecks: SavedDeck[];
  canSave: boolean;
  onSave: (name: string) => void;
  onLoad: (deck: SavedDeck) => void;
  onDelete: (id: string) => void;
  onExportCurrent: (name: string) => void;
  onImport: (deck: DeckFileData) => string;
}

export default function SavedDecks({
  savedDecks,
  canSave,
  onSave,
  onLoad,
  onDelete,
  onExportCurrent,
  onImport,
}: SavedDecksProps) {
  const [name, setName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [fileMessage, setFileMessage] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  async function handleImport(file: File) {
    setImporting(true);
    setFileMessage(null);
    setFileError(null);
    try {
      const deck = parseDeckFile(await file.text());
      const importedName = onImport(deck);
      setFileMessage(`「${importedName}」を保存一覧に追加しました。「読み込む」で編集できます。`);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'ファイルのインポートに失敗しました。');
    } finally {
      setImporting(false);
    }
  }

  const existingNames = new Set(savedDecks.map((deck) => deck.name));
  const trimmed = name.trim();
  const isOverwrite = existingNames.has(trimmed);

  function handleSave() {
    if (!trimmed || !canSave) return;
    onSave(trimmed);
    setName('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">保存したデッキ</h2>
      </div>

      <div className="p-3 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="デッキ名を入力して保存"
            className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-action"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!trimmed || !canSave}
          >
            {isOverwrite ? '上書き保存' : '保存'}
          </Button>
        </div>
        {!canSave && (
          <p className="text-xs text-gray-400">
            カードを1枚以上追加すると保存できます
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled={!canSave}
            onClick={() => onExportCurrent(trimmed || 'デッキ')}>
            編集中のデッキをエクスポート
          </Button>
          <Button variant="secondary" size="sm" disabled={importing}
            onClick={() => fileInputRef.current?.click()}>
            {importing ? 'インポート中…' : 'インポート'}
          </Button>
          <input ref={fileInputRef} type="file" accept=".json,application/json"
            aria-label="デッキのJSONファイル" className="hidden" disabled={importing}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void handleImport(file);
            }} />
        </div>
        <p className="text-xs text-gray-400">
          カード・枚数・ラベル・条件をJSON形式で保存・復元します。同名デッキは別名で追加します。
        </p>
        {fileMessage && <p role="status" className="text-xs text-emerald-700">{fileMessage}</p>}
        {fileError && <p role="alert" className="text-xs text-red-600">{fileError}</p>}

        {savedDecks.length === 0 ? (
          <p className="text-xs text-gray-400 py-2 text-center">
            保存されたデッキはまだありません
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {savedDecks.map((deck) => (
              <li key={deck.id} className="group">
                {confirmDelete === deck.id ? (
                  <div className="flex items-center gap-2 py-1.5 px-2 bg-red-50 rounded-lg">
                    <span className="flex-1 text-xs text-red-700 truncate">
                      「{deck.name}」を削除しますか？
                    </span>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        onDelete(deck.id);
                        setConfirmDelete(null);
                      }}
                    >
                      削除
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDelete(null)}
                    >
                      ✕
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg hover:bg-gray-50 px-2 py-1">
                    <span className="flex-1 text-sm text-gray-800 truncate">
                      {deck.name}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        onLoad(deck);
                        setName(deck.name);
                      }}
                    >
                      読み込む
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadDeckFile(deck)}
                      aria-label={`${deck.name}をエクスポート`}
                    >
                      エクスポート
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDelete(deck.id)}
                      aria-label={`${deck.name}を削除`}
                    >
                      ✕
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
