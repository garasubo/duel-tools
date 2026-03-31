import { useState, useRef, useEffect } from "react";
import { useBattlesContext } from "../context/BattlesContext";
import Button from "../components/ui/Button";
import type { Deck } from "../types";

// --- DeckSection ---

interface DeckSectionProps {
  title: string;
  decks: Deck[];
  onAdd: (name: string) => void;
  onUpdate: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  isUsed: (id: string) => boolean;
}

function DeckSection({
  title,
  decks,
  onAdd,
  onUpdate,
  onDelete,
  isUsed,
}: DeckSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addValue, setAddValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId !== null) editInputRef.current?.focus();
  }, [editingId]);

  useEffect(() => {
    if (isAdding) addInputRef.current?.focus();
  }, [isAdding]);

  const startEdit = (deck: Deck) => {
    setEditingId(deck.id);
    setEditValue(deck.name);
  };

  const commitEdit = () => {
    if (editingId && editValue.trim()) {
      onUpdate(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const commitAdd = () => {
    if (addValue.trim()) {
      onAdd(addValue.trim());
    }
    setIsAdding(false);
    setAddValue("");
  };

  const cancelAdd = () => {
    setIsAdding(false);
    setAddValue("");
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      </div>
      <ul className="divide-y divide-gray-100">
        {decks.map((deck) => (
          <li key={deck.id} className="flex items-center gap-2 px-4 py-2.5">
            {editingId === deck.id ? (
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
                  onClick={() => startEdit(deck)}
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
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditingId(null);
              setIsAdding(true);
            }}
          >
            ＋ 追加
          </Button>
        </div>
      )}
    </section>
  );
}

// --- TagSection ---

interface TagSectionProps {
  tags: string[];
  onAdd: (tag: string) => void;
  onUpdate: (oldTag: string, newTag: string) => void;
  onDelete: (tag: string) => void;
  isTagUsed: (tag: string) => boolean;
}

function TagSection({
  tags,
  onAdd,
  onUpdate,
  onDelete,
  isTagUsed,
}: TagSectionProps) {
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addValue, setAddValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTag !== null) editInputRef.current?.focus();
  }, [editingTag]);

  useEffect(() => {
    if (isAdding) addInputRef.current?.focus();
  }, [isAdding]);

  const startEdit = (tag: string) => {
    setEditingTag(tag);
    setEditValue(tag);
  };

  const commitEdit = () => {
    if (editingTag && editValue.trim()) {
      onUpdate(editingTag, editValue.trim());
    }
    setEditingTag(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingTag(null);
    setEditValue("");
  };

  const commitAdd = () => {
    if (addValue.trim()) {
      onAdd(addValue.trim());
    }
    setIsAdding(false);
    setAddValue("");
  };

  const cancelAdd = () => {
    setIsAdding(false);
    setAddValue("");
  };

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
            {editingTag === tag ? (
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
                  onClick={() => startEdit(tag)}
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
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditingTag(null);
              setIsAdding(true);
            }}
          >
            ＋ 追加
          </Button>
        </div>
      )}
    </section>
  );
}

// --- ManagePage ---

export default function ManagePage() {
  const {
    ownDecks,
    opponentDecks,
    knownTags,
    addOwnDeck,
    updateOwnDeck,
    deleteOwnDeck,
    addOpponentDeck,
    updateOpponentDeck,
    deleteOpponentDeck,
    addKnownTag,
    updateKnownTag,
    deleteKnownTag,
    isOwnDeckUsed,
    isOpponentDeckUsed,
    isTagUsed,
  } = useBattlesContext();

  return (
    <div className="p-4 space-y-4">
      <DeckSection
        title="自分のデッキ"
        decks={ownDecks}
        onAdd={addOwnDeck}
        onUpdate={updateOwnDeck}
        onDelete={deleteOwnDeck}
        isUsed={isOwnDeckUsed}
      />
      <DeckSection
        title="相手のデッキ"
        decks={opponentDecks}
        onAdd={addOpponentDeck}
        onUpdate={updateOpponentDeck}
        onDelete={deleteOpponentDeck}
        isUsed={isOpponentDeckUsed}
      />
      <TagSection
        tags={knownTags}
        onAdd={addKnownTag}
        onUpdate={updateKnownTag}
        onDelete={deleteKnownTag}
        isTagUsed={isTagUsed}
      />
    </div>
  );
}
