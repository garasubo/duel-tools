export interface TagChipProps {
  label: string;
  onRemove?: () => void;
  className?: string;
}

export default function TagChip({ label, onRemove, className = '' }: TagChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-soft text-brand-action-hover text-xs font-medium border border-brand-cyan/30 ${className}`}
    >
      {label}
      {onRemove !== undefined && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${label}を削除`}
          className="ml-0.5 -mr-0.5 flex items-center justify-center w-4 h-4 rounded-full text-brand-action hover:bg-brand-cyan/30 hover:text-brand-action-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-action transition-colors duration-100 cursor-pointer"
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </span>
  );
}
