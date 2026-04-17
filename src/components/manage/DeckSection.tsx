import Button from "../ui/Button";
import type { Deck } from "../../types";
import { useListEditor } from "../../hooks/useListEditor";

export interface DeckSectionProps {
  title: string;
  decks: Deck[];
  onAdd: (name: string) => void;
  onUpdate: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  isUsed: (id: string) => boolean;
}

export default function DeckSection({
  title,
  decks,
  onAdd,
  onUpdate,
  onDelete,
  isUsed,
}: DeckSectionProps) {
  const {
    isEditing,
    editValue,
    setEditValue,
    editInputRef,
    startEdit,
    commitEdit,
    cancelEdit,
    isAdding,
    addValue,
    setAddValue,
    addInputRef,
    startAdd,
    commitAdd,
    cancelAdd,
  } = useListEditor<string>({ onAdd, onUpdate });

  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      </div>
      <ul className="divide-y divide-gray-100">
        {decks.map((deck) => (
          <li key={deck.id} className="flex items-center gap-2 px-4 py-2.5">
            {isEditing(deck.id) ? (
              <>
                <input
                  ref={editInputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Button size="sm" variant="primary" onClick={commitEdit}>
                  保存
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  キャンセル
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-gray-800">
                  {deck.name}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => startEdit(deck.id, deck.name)}
                >
                  編集
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => onDelete(deck.id)}
                  disabled={isUsed(deck.id)}
                  title={
                    isUsed(deck.id)
                      ? "履歴で使用中のため削除できません"
                      : "削除"
                  }
                >
                  削除
                </Button>
              </>
            )}
          </li>
        ))}
        {decks.length === 0 && !isAdding && (
          <li className="px-4 py-4 text-sm text-gray-400 text-center">
            まだ登録されていません
          </li>
        )}
        {isAdding && (
          <li className="flex items-center gap-2 px-4 py-2.5">
            <input
              ref={addInputRef}
              type="text"
              value={addValue}
              placeholder="デッキ名を入力"
              onChange={(e) => setAddValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitAdd();
                if (e.key === "Escape") cancelAdd();
              }}
              className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <Button size="sm" variant="primary" onClick={commitAdd}>
              追加
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelAdd}>
              キャンセル
            </Button>
          </li>
        )}
      </ul>
      {!isAdding && (
        <div className="px-4 py-2.5 border-t border-gray-100">
          <Button size="sm" variant="secondary" onClick={startAdd}>
            ＋ 追加
          </Button>
        </div>
      )}
    </section>
  );
}
