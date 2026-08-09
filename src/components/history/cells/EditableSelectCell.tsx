import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface Option {
  value: string;
  label: string;
}

interface EditableSelectCellProps {
  value: string;
  options: Option[];
  isEditing: boolean;
  onActivate: () => void;
  onSave: (value: string) => void;
  onCancel: () => void;
  renderDisplay?: () => ReactNode;
  editable?: boolean;
}

export default function EditableSelectCell({
  value,
  options,
  isEditing,
  onActivate,
  onSave,
  onCancel,
  renderDisplay,
  editable = true,
}: EditableSelectCellProps) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const savedRef = useRef(false);

  useEffect(() => {
    if (isEditing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isEditing]);

  if (!editable) {
    const displayLabel = options.find((o) => o.value === value)?.label ?? value;
    return <div className="px-1 -mx-1">{renderDisplay ? renderDisplay() : displayLabel}</div>;
  }

  if (!isEditing) {
    const displayLabel = options.find((o) => o.value === value)?.label ?? value;
    return (
      <div
        onClick={onActivate}
        className="cursor-pointer rounded px-1 -mx-1 hover:bg-brand-soft transition-colors"
        title="クリックして編集"
      >
        {renderDisplay ? renderDisplay() : displayLabel}
      </div>
    );
  }

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    savedRef.current = true;
    onSave(e.target.value);
  }

  function handleBlur() {
    if (!savedRef.current) {
      onCancel();
    }
    savedRef.current = false;
  }

  return (
    <select
      ref={selectRef}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      className="rounded border border-brand-cyan/50 px-1 py-0.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-action"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
