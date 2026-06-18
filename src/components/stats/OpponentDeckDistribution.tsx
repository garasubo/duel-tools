import type { OpponentDeckStat } from '../../hooks/useStats';

interface OpponentDeckDistributionProps {
  opponentDeckStats: OpponentDeckStat[];
}

export default function OpponentDeckDistribution({
  opponentDeckStats,
}: OpponentDeckDistributionProps) {
  const total = opponentDeckStats.reduce((sum, s) => sum + s.overall.total, 0);

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-700 mb-2">相手デッキ分布</h2>
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        {total === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">対戦データがありません</p>
        ) : (
          <div className="flex flex-col gap-2">
            {opponentDeckStats.map((s) => {
              const share = total > 0 ? s.overall.total / total : 0;
              return (
                <div key={s.deckId} className="flex items-center gap-2">
                  <span
                    className="w-24 shrink-0 text-xs text-gray-700 truncate"
                    title={s.deckName}
                  >
                    {s.deckName}
                  </span>
                  <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${share * 100}%` }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right text-xs text-gray-500 tabular-nums">
                    {s.overall.total} ({(share * 100).toFixed(0)}%)
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
