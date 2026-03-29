import type { MatchupCell, WinLoss } from '../../hooks/useStats';
import type { Deck } from '../../types';
import WinRateBar from './WinRateBar';

interface MatchupTableProps {
  matchupCells: MatchupCell[];
  ownDecks: Deck[];
  opponentDecks: Deck[];
}

function winRateText(stats: WinLoss): string {
  return `${(stats.winRate * 100).toFixed(1)}%`;
}

function winRateColor(stats: WinLoss): string {
  if (stats.winRate > 0.5) return 'text-emerald-700';
  if (stats.winRate < 0.5) return 'text-red-700';
  return 'text-gray-700';
}

export default function MatchupTable({ matchupCells, ownDecks, opponentDecks }: MatchupTableProps) {
  if (matchupCells.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-4 text-center border border-gray-200 rounded-xl">
        対戦データがありません
      </p>
    );
  }

  const activeOwnIds = new Set(matchupCells.map((c) => c.ownDeckId));
  const activeOppIds = new Set(matchupCells.map((c) => c.opponentDeckId));

  const activeOwnDecks = ownDecks.filter((d) => activeOwnIds.has(d.id));
  const activeOppDecks = opponentDecks.filter((d) => activeOppIds.has(d.id));

  const lookup = new Map<string, Map<string, WinLoss>>();
  for (const cell of matchupCells) {
    if (!lookup.has(cell.ownDeckId)) {
      lookup.set(cell.ownDeckId, new Map());
    }
    lookup.get(cell.ownDeckId)!.set(cell.opponentDeckId, cell.stats);
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-700 mb-2">マッチアップ</h2>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="text-sm border-collapse">
          <thead>
            <tr className="bg-white border-b border-gray-200">
              <th className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-gray-600 whitespace-nowrap border-r border-gray-100">
                自分 ＼ 相手
              </th>
              {activeOppDecks.map((opp) => (
                <th
                  key={opp.id}
                  className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap max-w-32 truncate"
                  title={opp.name}
                >
                  {opp.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeOwnDecks.map((own) => (
              <tr key={own.id} className="border-t border-gray-100">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-gray-700 whitespace-nowrap border-r border-gray-100">
                  {own.name}
                </td>
                {activeOppDecks.map((opp) => {
                  const stats = lookup.get(own.id)?.get(opp.id);
                  return (
                    <td key={opp.id} className="px-3 py-2">
                      {stats ? (
                        <div className="flex flex-col gap-0.5 min-w-20">
                          <span className={`text-xs font-bold ${winRateColor(stats)}`}>
                            {winRateText(stats)}
                          </span>
                          <WinRateBar stats={stats} compact />
                          <span className="text-xs text-gray-400">{stats.total}試合</span>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-center block">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
