import { useState } from "react";
import { useRecords } from "../state/hooks/useRecords";
import { useOwnDecks } from "../state/hooks/useOwnDecks";
import { useOpponentDecks } from "../state/hooks/useOpponentDecks";
import { useStats } from "../hooks/useStats";
import EmptyState from "../components/ui/EmptyState";
import OverallSummaryCard from "../components/stats/OverallSummaryCard";
import OpponentDeckDistribution from "../components/stats/OpponentDeckDistribution";
import OpponentDeckStatsTable from "../components/stats/OpponentDeckStatsTable";
import DeckStatsTable from "../components/stats/DeckStatsTable";
import MatchupTable from "../components/stats/MatchupTable";
import { openOverlay } from "../utils/openOverlay";
import DPTransitionChart from "../components/stats/DPTransitionChart";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function StatsPage() {
  useDocumentTitle("統計 | 戦績記録 - duel-tools");
  const { items: records } = useRecords();
  const { items: ownDecks } = useOwnDecks();
  const { items: opponentDecks } = useOpponentDecks();
  const [includeGrantedFirst, setIncludeGrantedFirst] = useState(false);
  const { overall, asFirst, asSecond, deckStats, opponentDeckStats, matchupCells } = useStats(
    records,
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
      <div className="flex items-center gap-2">
        <input
          id="include-granted-first"
          type="checkbox"
          checked={includeGrantedFirst}
          onChange={(e) => setIncludeGrantedFirst(e.target.checked)}
          className="w-4 h-4 accent-blue-600"
        />
        <label
          htmlFor="include-granted-first"
          className="text-sm text-gray-600 select-none cursor-pointer"
        >
          ゆずられ先攻を先攻に含める
        </label>
      </div>
      <OverallSummaryCard
        overall={overall}
        asFirst={asFirst}
        asSecond={asSecond}
      />
      <OpponentDeckDistribution opponentDeckStats={opponentDeckStats} />
      <OpponentDeckStatsTable opponentDeckStats={opponentDeckStats} />
      <DeckStatsTable deckStats={deckStats} />
      <MatchupTable
        matchupCells={matchupCells}
        ownDecks={ownDecks}
        opponentDecks={opponentDecks}
      />
      <DPTransitionChart records={records} />
    </div>
  );
}
