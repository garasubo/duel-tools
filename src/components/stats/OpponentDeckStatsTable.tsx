import type { OpponentDeckStat, StatsSplitMode } from '../../hooks/useStats';
import WinRateCell from './WinRateCell';
import { pickSplit, STATS_SPLIT_LABELS } from './statsSplit';

interface OpponentDeckStatsTableProps {
  opponentDeckStats: OpponentDeckStat[];
  splitMode: StatsSplitMode;
}

export default function OpponentDeckStatsTable({
  opponentDeckStats,
  splitMode,
}: OpponentDeckStatsTableProps) {
  const [leftLabel, rightLabel] = STATS_SPLIT_LABELS[splitMode];
  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-700 mb-2">対戦相手別勝率</h2>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-white border-b border-gray-200">
              <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">相手デッキ名</th>
              <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">総合</th>
              <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">{leftLabel}</th>
              <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">{rightLabel}</th>
              <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap text-right">試合数</th>
            </tr>
          </thead>
          <tbody>
            {opponentDeckStats.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-sm text-gray-400 text-center">
                  対戦データがありません
                </td>
              </tr>
            ) : (
              opponentDeckStats.map((deck) => (
                <tr key={deck.deckId} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                    {deck.deckName}
                  </td>
                  <td className="px-3 py-2">
                    <WinRateCell stats={deck.overall} />
                  </td>
                  <td className="px-3 py-2">
                    <WinRateCell stats={pickSplit(deck, splitMode)[0]} />
                  </td>
                  <td className="px-3 py-2">
                    <WinRateCell stats={pickSplit(deck, splitMode)[1]} />
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
