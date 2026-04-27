import { useEffect, useRef, useState } from "react";

interface NumberInputProps {
  initialValue: number | undefined;
  onSave: (value: number | undefined) => void;
  onCancel: () => void;
  min?: number;
  max?: number;
}

function NumberInput({
  initialValue,
  onSave,
  onCancel,
  min,
  max,
}: NumberInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = useState(
    initialValue !== undefined ? String(initialValue) : "",
  );
  const cancelledRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function commit() {
    if (cancelledRef.current) return;
    const num = localValue === "" ? undefined : Number(localValue);
    if (localValue !== "" && isNaN(num as number)) {
      onCancel();
      return;
    }
    onSave(num);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      cancelledRef.current = true;
      onCancel();
    }
  }

  return (
    <input
      ref={inputRef}
      type="number"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      min={min}
      max={max}
      className="w-28 rounded border border-indigo-300 px-1 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
    />
  );
}

interface EditableNumberCellProps {
  value: number | undefined;
  isEditing: boolean;
  onActivate: () => void;
  onSave: (value: number | undefined) => void;
  onCancel: () => void;
  min?: number;
  max?: number;
}

export default function EditableNumberCell({
  value,
  isEditing,
  onActivate,
  onSave,
  onCancel,
  min,
  max,
}: EditableNumberCellProps) {
  if (!isEditing) {
    return (
      <div
        onClick={onActivate}
        className="cursor-pointer rounded px-1 -mx-1 hover:bg-indigo-100 transition-colors min-h-[1.5rem]"
        title="クリックして編集"
      >
        {value !== undefined ? value.toLocaleString() : ""}
      </div>
    );
  }

  return (
    <NumberInput
      initialValue={value}
      onSave={onSave}
      onCancel={onCancel}
      min={min}
      max={max}
    />
  );
}
