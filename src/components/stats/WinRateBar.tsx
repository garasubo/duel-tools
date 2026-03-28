import type { WinLossDraw } from '../../hooks/useStats';

interface WinRateBarProps {
  stats: WinLossDraw;
  showCounts?: boolean;
  compact?: boolean;
  className?: string;
}

export default function WinRateBar({
  stats,
  showCounts = false,
  compact = false,
  className = '',
}: WinRateBarProps) {
  const { win, loss, draw, total } = stats;

  return (
    <div className={className}>
      <div
        className={`${compact ? 'h-1.5' : 'h-2'} rounded-full overflow-hidden bg-gray-100 flex w-full`}
      >
        {total > 0 && (
          <>
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${(win / total) * 100}%` }}
            />
            <div
              className="h-full bg-red-500 transition-all duration-300"
              style={{ width: `${(loss / total) * 100}%` }}
            />
            <div
              className="h-full bg-amber-400 transition-all duration-300"
              style={{ width: `${(draw / total) * 100}%` }}
            />
          </>
        )}
      </div>
      {showCounts && total > 0 && (
        <p className="text-xs text-gray-500 mt-0.5">
          {win}勝 {loss}敗 {draw}分
        </p>
      )}
    </div>
  );
}
