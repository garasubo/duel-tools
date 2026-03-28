import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export interface ToggleButtonProps extends ComponentPropsWithoutRef<'button'> {
  isSelected: boolean;
}

export interface ToggleButtonGroupProps {
  label: string;
  children: ReactNode;
  className?: string;
}

const selectedClasses =
  'border-indigo-600 bg-indigo-600 text-white shadow-sm';
const unselectedClasses =
  'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300';

const baseClasses =
  'inline-flex items-center justify-center px-4 py-2 text-sm font-medium ' +
  'rounded-lg border transition-colors duration-150 cursor-pointer ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ' +
  'focus-visible:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed';

export default function ToggleButton({
  isSelected,
  className = '',
  children,
  ...props
}: ToggleButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      className={`${baseClasses} ${isSelected ? selectedClasses : unselectedClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function ToggleButtonGroup({
  label,
  children,
  className = '',
}: ToggleButtonGroupProps) {
  return (
    <div role="group" aria-label={label} className={`flex gap-2 flex-wrap ${className}`}>
      {children}
    </div>
  );
}
