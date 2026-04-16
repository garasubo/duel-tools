import { useBattlesContext } from '../context/BattlesContext';
import { useStats } from '../hooks/useStats';
import type { WinLoss } from '../hooks/useStats';
import type { OverlayStatId } from '../types';
import { OVERLAY_STAT_DEFINITIONS } from '../utils/overlayStats';

function StatBlock({ label, wld }: { label: string; wld: WinLoss }) {
  const rate = wld.total === 0 ? '-' : `${Math.round(wld.winRate * 100)}%`;
  return (
    <div className="flex flex-col items-center gap-0.5 w-20">
      <span className="text-s text-gray-300 font-medium">{label}</span>
      <span className="text-2xl font-bold text-white leading-none">{rate}</span>
      {wld.total > 0 && (
        <span className="text-s text-gray-300">
          {wld.win}勝{wld.loss}負
        </span>
      )}
    </div>
  );
}

function MatchCountBlock({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 w-20">
      <span className="text-s text-gray-300 font-medium">{label}</span>
      <span className="text-2xl font-bold text-white leading-none">{count}</span>
      <span className="text-s text-gray-300">戦</span>
    </div>
  );
}

export default function OverlayPage() {
  const { records, ownDecks, opponentDecks, overlayStatSettings } = useBattlesContext();
  const { overall, asFirst, asSecond, coinToss } = useStats(records, ownDecks, opponentDecks, true);
  const winLossStatMap: Record<Exclude<OverlayStatId, 'matchCount'>, WinLoss> = {
    overall,
    asFirst,
    asSecond,
    coinToss,
  };
  const visibleStats = overlayStatSettings
    .filter((setting) => setting.visible)
    .map((setting) => {
      const definition = OVERLAY_STAT_DEFINITIONS.find((stat) => stat.id === setting.id);
      if (!definition) {
        return null;
      }

      return {
        id: definition.id,
        label: definition.label,
        value:
          definition.id === 'matchCount'
            ? { kind: 'count' as const, count: records.length }
            : { kind: 'wld' as const, wld: winLossStatMap[definition.id] },
      };
    })
    .filter((stat) => stat !== null);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900">
      <div className="flex items-center gap-4 px-4 py-4 bg-gray-800 rounded-xl border border-gray-700">
        {visibleStats.map((stat, index) => (
          <div key={stat.id} className="flex items-center gap-4">
            {index > 0 && <div className="w-px h-12 bg-gray-600" />}
            {stat.value.kind === 'count' ? (
              <MatchCountBlock label={stat.label} count={stat.value.count} />
            ) : (
              <StatBlock label={stat.label} wld={stat.value.wld} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
