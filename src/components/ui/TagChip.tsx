export interface TagChipProps {
  label: string;
  onRemove?: () => void;
  className?: string;
}

export default function TagChip({ label, onRemove, className = '' }: TagChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-200 ${className}`}
    >
      {label}
      {onRemove !== undefined && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${label}を削除`}
          className="ml-0.5 -mr-0.5 flex items-center justify-center w-4 h-4 rounded-full text-indigo-500 hover:bg-indigo-200 hover:text-indigo-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 transition-colors duration-100 cursor-pointer"
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </span>
  );
}
