import { useState, useRef } from "react";

export interface TagInputProps {
  tags: string[];
  knownTags: string[];
  onChange: (tags: string[]) => void;
  onAddKnownTag: (tag: string) => void;
}

export default function TagInput({
  tags,
  knownTags,
  onChange,
  onAddKnownTag,
}: TagInputProps) {
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function toggleTag(tag: string) {
    if (tags.includes(tag)) {
      onChange(tags.filter((t) => t !== tag));
    } else {
      onChange([...tags, tag]);
    }
  }

  function handleAddStart() {
    setAdding(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleConfirm() {
    const trimmed = input.trim();
    if (trimmed) {
      onAddKnownTag(trimmed);
      if (!tags.includes(trimmed)) {
        onChange([...tags, trimmed]);
      }
    }
    setInput("");
    setAdding(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === "Escape") {
      setInput("");
      setAdding(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">勝敗理由タグ</label>
      <div className="flex flex-wrap gap-1.5 items-center">
        {knownTags.map((tag) => {
          const selected = tags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
                selected
                  ? "bg-brand-action text-white border-brand-action"
                  : "bg-white text-gray-700 border-gray-300 hover:border-brand-cyan hover:text-brand-action"
              }`}
            >
              {selected && <span>✓</span>}
              {tag}
            </button>
          );
        })}
        {adding ? (
          <div className="inline-flex items-center gap-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="タグ名"
              className="border border-brand-cyan rounded-full px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-brand-action w-28"
            />
            <button
              type="button"
              onClick={handleConfirm}
              className="px-2 py-1 text-sm text-brand-action hover:text-brand-action-hover font-medium"
            >
              追加
            </button>
            <button
              type="button"
              onClick={() => {
                setInput("");
                setAdding(false);
              }}
              className="px-2 py-1 text-sm text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleAddStart}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm border border-dashed border-gray-300 text-gray-500 hover:border-brand-cyan hover:text-brand-action transition-colors cursor-pointer"
          >
            <span>＋</span> タグを追加
          </button>
        )}
      </div>
    </div>
  );
}
