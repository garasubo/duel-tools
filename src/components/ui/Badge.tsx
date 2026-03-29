import type { BattleResult } from '../../types';

export interface BadgeProps {
  result: BattleResult;
  className?: string;
}

const resultConfig: Record<
  BattleResult,
  { label: string; ariaLabel: string; classes: string }
> = {
  win: {
    label: '勝',
    ariaLabel: '勝利',
    classes: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  loss: {
    label: '負',
    ariaLabel: '敗北',
    classes: 'bg-red-100 text-red-800 border-red-200',
  },
};

export default function Badge({ result, className = '' }: BadgeProps) {
  const { label, ariaLabel, classes } = resultConfig[result];
  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold border select-none ${classes} ${className}`}
    >
      {label}
    </span>
  );
}
