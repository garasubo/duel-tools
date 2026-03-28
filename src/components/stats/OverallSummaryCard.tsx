import type { WinLossDraw } from '../../hooks/useStats';
import WinRateBar from './WinRateBar';

interface OverallSummaryCardProps {
  overall: WinLossDraw;
  asFirst: WinLossDraw;
  asSecond: WinLossDraw;
}

function winRateText(stats: WinLossDraw): string {
  if (stats.total === 0) return '—';
  return `${(stats.winRate * 100).toFixed(1)}%`;
}

function winRateColor(stats: WinLossDraw): string {
  if (stats.total === 0) return 'text-gray-400';
  if (stats.winRate > 0.5) return 'text-emerald-700';
  if (stats.winRate < 0.5) return 'text-red-700';
  return 'text-gray-700';
}

interface SubCardProps {
  label: string;
  stats: WinLossDraw;
}

function SubCard({ label, stats }: SubCardProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 flex flex-col gap-2">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      {stats.total === 0 ? (
        <span className="text-xs text-gray-400">記録なし</span>
      ) : (
        <>
          <span className={`text-lg font-bold ${winRateColor(stats)}`}>{winRateText(stats)}</span>
          <WinRateBar stats={stats} showCounts />
        </>
      )}
    </div>
  );
}

export default function OverallSummaryCard({ overall, asFirst, asSecond }: OverallSummaryCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <span className="text-sm font-semibold text-gray-700">総合勝率</span>
        <span className={`text-3xl font-bold ${winRateColor(overall)}`}>{winRateText(overall)}</span>
        {overall.total > 0 && (
          <span className="text-sm text-gray-500">{overall.total}試合</span>
        )}
      </div>
      <WinRateBar stats={overall} showCounts />
      <div className="grid grid-cols-2 gap-3">
        <SubCard label="先行" stats={asFirst} />
        <SubCard label="後攻" stats={asSecond} />
      </div>
    </div>
  );
}
