import { useBattlesContext } from '../context/BattlesContext';
import { useStats } from '../hooks/useStats';
import type { WinLoss } from '../hooks/useStats';

function StatBlock({ label, wld }: { label: string; wld: WinLoss }) {
  const rate = wld.total === 0 ? '-' : `${Math.round(wld.winRate * 100)}%`;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-xs text-gray-400 font-medium">{label}</span>
      <span className="text-3xl font-bold text-white leading-none">{rate}</span>
      {wld.total > 0 && (
        <span className="text-xs text-gray-400">
          {wld.win}勝{wld.loss}負
        </span>
      )}
    </div>
  );
}

export default function OverlayPage() {
  const { records, ownDecks, opponentDecks } = useBattlesContext();
  const { overall, asFirst, asSecond, coinToss } = useStats(records, ownDecks, opponentDecks, true);

  if (records.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <span className="text-gray-500 text-sm">成績なし</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900">
      <div className="flex items-center gap-8 px-8 py-4 bg-gray-800 rounded-xl border border-gray-700">
        <StatBlock label="全体" wld={overall} />
        <div className="w-px h-12 bg-gray-600" />
        <StatBlock label="先攻" wld={asFirst} />
        <StatBlock label="後攻" wld={asSecond} />
        <div className="w-px h-12 bg-gray-600" />
        <StatBlock label="コイントス" wld={coinToss} />
      </div>
    </div>
  );
}
