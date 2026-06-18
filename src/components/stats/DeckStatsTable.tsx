import type { DeckStat } from '../../hooks/useStats';
import WinRateCell from './WinRateCell';

interface DeckStatsTableProps {
  deckStats: DeckStat[];
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
              <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">先攻</th>
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
