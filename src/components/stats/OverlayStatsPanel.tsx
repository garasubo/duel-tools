import { useRecords } from '../../state/hooks/useRecords';
import { useOwnDecks } from '../../state/hooks/useOwnDecks';
import { useOpponentDecks } from '../../state/hooks/useOpponentDecks';
import { useOverlaySettings } from '../../state/hooks/useOverlaySettings';
import { useStats } from '../../hooks/useStats';
import type { WinLoss } from '../../hooks/useStats';
import type { BattleRecord, OverlayStatId, PanelDateFilter } from '../../types';
import { OVERLAY_STAT_DEFINITIONS } from '../../utils/overlayStats';

const FILTER_LABELS: Record<string, string> = {
  today: '今日',
  last7days: '直近7日',
  last30days: '直近30日',
  since: '指定日以降',
};

function filterRecordsByDate(records: BattleRecord[], filter: PanelDateFilter): BattleRecord[] {
  const { type, sinceDate } = filter;
  if (type === 'none') return records;
  let cutoff = new Date();
  if (type === 'today') {
    cutoff.setHours(0, 0, 0, 0);
  } else if (type === 'last7days') {
    cutoff.setDate(cutoff.getDate() - 7);
  } else if (type === 'last30days') {
    cutoff.setDate(cutoff.getDate() - 30);
  } else if (type === 'since') {
    if (!sinceDate) return records;
    cutoff = new Date(sinceDate + 'T00:00:00');
  }
  return records.filter((r) => new Date(r.createdAt) >= cutoff);
}

function StatBlock({
  label,
  wld,
  dark,
}: {
  label: string;
  wld: WinLoss;
  dark: boolean;
}) {
  const rate = wld.total === 0 ? '-' : `${Math.round(wld.winRate * 100)}%`;
  return (
    <div className="flex flex-col items-center gap-0.5 w-20">
      <span className={`text-s font-medium ${dark ? 'text-gray-300' : 'text-gray-500'}`}>
        {label}
      </span>
      <span className={`text-2xl font-bold leading-none ${dark ? 'text-white' : 'text-gray-800'}`}>
        {rate}
      </span>
      {wld.total > 0 && (
        <span className={`text-s ${dark ? 'text-gray-300' : 'text-gray-500'}`}>
          {wld.win}勝{wld.loss}負
        </span>
      )}
    </div>
  );
}

function MatchCountBlock({
  label,
  count,
  dark,
}: {
  label: string;
  count: number;
  dark: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 w-20">
      <span className={`text-s font-medium ${dark ? 'text-gray-300' : 'text-gray-500'}`}>
        {label}
      </span>
      <span className={`text-2xl font-bold leading-none ${dark ? 'text-white' : 'text-gray-800'}`}>
        {count}
      </span>
      <span className={`text-s ${dark ? 'text-gray-300' : 'text-gray-500'}`}>戦</span>
    </div>
  );
}

export function OverlayStatsPanel({ variant }: { variant: 'overlay' | 'panel' }) {
  const { items: records } = useRecords();
  const { items: ownDecks } = useOwnDecks();
  const { items: opponentDecks } = useOpponentDecks();
  const { stats: overlayStatSettings, dateFilter: panelDateFilter } = useOverlaySettings();
  const filteredRecords = filterRecordsByDate(records, panelDateFilter);
  const { overall, asFirst, asSecond, coinToss } = useStats(filteredRecords, ownDecks, opponentDecks, true);
  const dark = variant === 'overlay';

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
      if (!definition) return null;
      return {
        id: definition.id,
        label: definition.label,
        value:
          definition.id === 'matchCount'
            ? { kind: 'count' as const, count: filteredRecords.length }
            : { kind: 'wld' as const, wld: winLossStatMap[definition.id] },
      };
    })
    .filter((stat) => stat !== null);

  const containerClass = dark
    ? 'flex items-center gap-4 px-4 py-4 bg-gray-800 rounded-xl border border-gray-700'
    : 'flex flex-col gap-1 px-4 py-3 bg-white rounded-xl border border-gray-200';

  const dividerClass = dark ? 'w-px h-12 bg-gray-600' : 'w-px h-12 bg-gray-200';

  const filterLabel = panelDateFilter.type !== 'none'
    ? panelDateFilter.type === 'since' && panelDateFilter.sinceDate
      ? `${panelDateFilter.sinceDate}以降`
      : FILTER_LABELS[panelDateFilter.type]
    : null;

  return (
    <div className={containerClass}>
      <div className="flex items-center gap-4">
        {visibleStats.map((stat, index) => (
          <div key={stat.id} className="flex items-center gap-4">
            {index > 0 && <div className={dividerClass} />}
            {stat.value.kind === 'count' ? (
              <MatchCountBlock label={stat.label} count={stat.value.count} dark={dark} />
            ) : (
              <StatBlock label={stat.label} wld={stat.value.wld} dark={dark} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
