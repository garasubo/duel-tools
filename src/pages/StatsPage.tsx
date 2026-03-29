import { useBattlesContext } from '../context/BattlesContext';
import { useStats } from '../hooks/useStats';
import EmptyState from '../components/ui/EmptyState';
import OverallSummaryCard from '../components/stats/OverallSummaryCard';
import DeckStatsTable from '../components/stats/DeckStatsTable';
import MatchupTable from '../components/stats/MatchupTable';
import { openOverlay } from '../utils/openOverlay';

export default function StatsPage() {
  const { records, ownDecks, opponentDecks } = useBattlesContext();
  const { overall, asFirst, asSecond, deckStats, matchupCells } = useStats(
    records,
    ownDecks,
    opponentDecks,
  );

  if (records.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          title="戦績がありません"
          description="対戦を記録すると統計が表示されます。"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-5xl mx-auto">
      <div className="flex justify-end">
        <button
          onClick={openOverlay}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          オーバーレイを開く
        </button>
      </div>
      <OverallSummaryCard overall={overall} asFirst={asFirst} asSecond={asSecond} />
      <DeckStatsTable deckStats={deckStats} />
      <MatchupTable matchupCells={matchupCells} ownDecks={ownDecks} opponentDecks={opponentDecks} />
    </div>
  );
}
