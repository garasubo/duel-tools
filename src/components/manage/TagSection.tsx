import Button from "../ui/Button";
import { useListEditor } from "../../hooks/useListEditor";

export interface TagSectionProps {
  tags: string[];
  onAdd: (tag: string) => void;
  onUpdate: (oldTag: string, newTag: string) => void;
  onDelete: (tag: string) => void;
  isTagUsed: (tag: string) => boolean;
}

export default function TagSection({
  tags,
  onAdd,
  onUpdate,
  onDelete,
  isTagUsed,
}: TagSectionProps) {
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

  const handleDelete = (tag: string) => {
    if (isTagUsed(tag)) {
      if (
        !window.confirm(
          `「${tag}」は履歴で使用されています。削除すると履歴からも除去されます。続けますか？`,
        )
      ) {
        return;
      }
    }
    onDelete(tag);
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-700">
          タグ（勝敗理由）
        </h2>
      </div>
      <ul className="divide-y divide-gray-100">
        {tags.map((tag) => (
          <li key={tag} className="flex items-center gap-2 px-4 py-2.5">
            {isEditing(tag) ? (
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
                <span className="flex-1 text-sm text-gray-800">{tag}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => startEdit(tag, tag)}
                >
                  編集
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleDelete(tag)}
                >
                  削除
                </Button>
              </>
            )}
          </li>
        ))}
        {tags.length === 0 && !isAdding && (
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
              placeholder="タグ名を入力"
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
