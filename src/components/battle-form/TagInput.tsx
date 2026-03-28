import { useState, useRef } from "react";
import TagChip from "../ui/TagChip";

export interface TagInputProps {
  tags: string[];
  knownTags: string[];
  onChange: (tags: string[]) => void;
}

export default function TagInput({ tags, knownTags, onChange }: TagInputProps) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = input.trim()
    ? knownTags.filter(
        (t) =>
          t.toLowerCase().includes(input.toLowerCase()) && !tags.includes(t),
      )
    : knownTags.filter((t) => !tags.includes(t));

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    onChange([...tags, trimmed]);
    setInput("");
    setShowSuggestions(false);
    inputRef.current?.focus();
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">勝敗理由タグ</label>
      <div className="relative">
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-gray-300 px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent bg-white min-h-[42px]">
          {tags.map((tag) => (
            <TagChip key={tag} label={tag} onRemove={() => removeTag(tag)} />
          ))}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? "タグを入力（Enterで追加）" : ""}
            className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
          />
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
            {suggestions.map((s) => (
              <li
                key={s}
                onMouseDown={() => addTag(s)}
                className="px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 hover:text-indigo-700"
              >
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
