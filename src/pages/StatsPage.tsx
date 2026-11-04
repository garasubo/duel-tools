import { useState } from "react";
import { useRecords } from "../state/hooks/useRecords";
import { useOwnDecks } from "../state/hooks/useOwnDecks";
import { useOpponentDecks } from "../state/hooks/useOpponentDecks";
import { useStats, type StatsSplitMode } from "../hooks/useStats";
import StatsSplitControls from "../components/stats/StatsSplitControls";
import EmptyState from "../components/ui/EmptyState";
import OverallSummaryCard from "../components/stats/OverallSummaryCard";
import OpponentDeckDistribution from "../components/stats/OpponentDeckDistribution";
import OpponentDeckStatsTable from "../components/stats/OpponentDeckStatsTable";
import DeckStatsTable from "../components/stats/DeckStatsTable";
import MatchupTable from "../components/stats/MatchupTable";
import { openOverlay } from "../utils/openOverlay";
import DPTransitionChart from "../components/stats/DPTransitionChart";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useFilter } from "../hooks/useFilter";
import FilterBar from "../components/history/FilterBar";

export default function StatsPage() {
  useDocumentTitle("統計 | 戦績記録 - duel-tools");
  const { items: records } = useRecords();
  const { items: ownDecks } = useOwnDecks();
  const { items: opponentDecks } = useOpponentDecks();
  const [splitMode, setSplitMode] = useState<StatsSplitMode>('coin');
  const [includeGrantedFirst, setIncludeGrantedFirst] = useState(false);
  const { filter, filtered, updateFilter, resetFilter } = useFilter(records);
  const { overall, breakdown, deckStats, opponentDeckStats, matchupCells } = useStats(
    filtered,
    ownDecks,
    opponentDecks,
    includeGrantedFirst,
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
      <FilterBar
        filter={filter}
        onChange={updateFilter}
        onReset={resetFilter}
        ownDecks={ownDecks}
        opponentDecks={opponentDecks}
      />
      <StatsSplitControls
        idPrefix="stats"
        mode={splitMode}
        onModeChange={setSplitMode}
        includeGrantedFirst={includeGrantedFirst}
        onIncludeGrantedFirstChange={setIncludeGrantedFirst}
      />
      <OverallSummaryCard overall={overall} breakdown={breakdown} splitMode={splitMode} />
      <OpponentDeckDistribution opponentDeckStats={opponentDeckStats} />
      <OpponentDeckStatsTable opponentDeckStats={opponentDeckStats} splitMode={splitMode} />
      <DeckStatsTable deckStats={deckStats} splitMode={splitMode} />
      <MatchupTable
        matchupCells={matchupCells}
        ownDecks={ownDecks}
        opponentDecks={opponentDecks}
      />
      <DPTransitionChart records={filtered} />
    </div>
  );
}
