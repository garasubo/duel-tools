import type { WinLoss } from '../../hooks/useStats';
import WinRateBar from './WinRateBar';

function winRateText(stats: WinLoss): string {
  if (stats.total === 0) return '—';
  return `${(stats.winRate * 100).toFixed(1)}%`;
}

function winRateColor(stats: WinLoss): string {
  if (stats.total === 0) return 'text-gray-400';
  if (stats.winRate > 0.5) return 'text-emerald-700';
  if (stats.winRate < 0.5) return 'text-red-700';
  return 'text-gray-700';
}

interface WinRateCellProps {
  stats: WinLoss;
}

export default function WinRateCell({ stats }: WinRateCellProps) {
  if (stats.total === 0) {
    return <span className="text-xs text-gray-400">—</span>;
  }
  return (
    <div className="flex flex-col gap-1 min-w-28">
      <span className={`text-sm font-semibold ${winRateColor(stats)}`}>{winRateText(stats)}</span>
      <WinRateBar stats={stats} compact />
      <span className="text-xs text-gray-500">
        {stats.win}勝 {stats.loss}敗
      </span>
    </div>
  );
}
