import type { DeckStat, WinLossDraw } from '../../hooks/useStats';
import WinRateBar from './WinRateBar';

interface DeckStatsTableProps {
  deckStats: DeckStat[];
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

interface WinRateCellProps {
  stats: WinLossDraw;
}

function WinRateCell({ stats }: WinRateCellProps) {
  if (stats.total === 0) {
    return <span className="text-xs text-gray-400">—</span>;
  }
  return (
    <div className="flex flex-col gap-1 min-w-28">
      <span className={`text-sm font-semibold ${winRateColor(stats)}`}>{winRateText(stats)}</span>
      <WinRateBar stats={stats} compact />
      <span className="text-xs text-gray-500">
        {stats.win}勝 {stats.loss}敗 {stats.draw}分
      </span>
    </div>
  );
}

export default function DeckStatsTable({ deckStats }: DeckStatsTableProps) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-700 mb-2">デッキ別勝率</h2>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-white border-b border-gray-200">
              <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">デッキ名</th>
              <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">総合</th>
              <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">先行</th>
              <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">後攻</th>
              <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap text-right">試合数</th>
            </tr>
          </thead>
          <tbody>
            {deckStats.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-sm text-gray-400 text-center">
                  デッキが登録されていません
                </td>
              </tr>
            ) : (
              deckStats.map((deck) => (
                <tr key={deck.deckId} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{deck.deckName}</td>
                  <td className="px-3 py-2">
                    <WinRateCell stats={deck.overall} />
                  </td>
                  <td className="px-3 py-2">
                    <WinRateCell stats={deck.asFirst} />
                  </td>
                  <td className="px-3 py-2">
                    <WinRateCell stats={deck.asSecond} />
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">{deck.overall.total}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
