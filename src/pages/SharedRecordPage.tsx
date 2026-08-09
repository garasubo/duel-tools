import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { createBattlesStore, type StorageLike } from '../state/store';
import { BattlesStoreContext } from '../state/BattlesProvider';
import { useRecords } from '../state/hooks/useRecords';
import { useOwnDecks } from '../state/hooks/useOwnDecks';
import { useOpponentDecks } from '../state/hooks/useOpponentDecks';
import { useFilter } from '../hooks/useFilter';
import { useStats } from '../hooks/useStats';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { SHARE_API_BASE, STORAGE_KEY } from '../utils/constants';
import {
  normalizeSharedSnapshot,
  sharedSnapshotToAppStorage,
} from '../utils/share';
import { formatDate } from '../utils/formatDate';
import type { AppStorage, SharedSnapshot } from '../types';
import FilterBar from '../components/history/FilterBar';
import RecordTable from '../components/history/RecordTable';
import EmptyState from '../components/ui/EmptyState';
import OverallSummaryCard from '../components/stats/OverallSummaryCard';
import OpponentDeckDistribution from '../components/stats/OpponentDeckDistribution';
import OpponentDeckStatsTable from '../components/stats/OpponentDeckStatsTable';
import DeckStatsTable from '../components/stats/DeckStatsTable';
import MatchupTable from '../components/stats/MatchupTable';
import DPTransitionChart from '../components/stats/DPTransitionChart';
import BrandLogo from '../components/BrandLogo';

type LoadStatus = 'loading' | 'ready' | 'notfound' | 'error';

// スナップショットを AppStorage として返すだけの読み取り専用ストレージ。
// 書き込みは no-op（共有ページでは変更を永続化しない）。
function createSnapshotStorage(appStorage: AppStorage): StorageLike {
  const serialized = JSON.stringify(appStorage);
  return {
    getItem: (key) => (key === STORAGE_KEY ? serialized : null),
    setItem: () => {},
    removeItem: () => {},
  };
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-canvas p-6">
      <div className="text-center text-gray-600">{children}</div>
    </div>
  );
}

export default function SharedRecordPage() {
  useDocumentTitle('共有された戦績 - duel-tools');
  const { shareId } = useParams<{ shareId: string }>();

  if (!shareId) {
    return (
      <Centered>
        <p className="mb-3">共有された戦績が見つかりませんでした。</p>
        <Link to="/record" className="text-brand-action hover:underline">
          duel-tools を開く
        </Link>
      </Centered>
    );
  }

  // shareId を key にして、リンク切り替え時にローダーを作り直す
  // （読み込み状態を副作用の同期 setState に頼らずリセットする）。
  return <SharedRecordLoader key={shareId} shareId={shareId} />;
}

function SharedRecordLoader({ shareId }: { shareId: string }) {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [snapshot, setSnapshot] = useState<SharedSnapshot | null>(null);

  useDocumentTitle(
    snapshot?.title
      ? `${snapshot.title} - 共有された戦績 - duel-tools`
      : '共有された戦績 - duel-tools',
  );

  useEffect(() => {
    let cancelled = false;
    fetch(`${SHARE_API_BASE}/shares/${encodeURIComponent(shareId)}`)
      .then(async (res) => {
        if (res.status === 404) {
          if (!cancelled) setStatus('notfound');
          return;
        }
        if (!res.ok) {
          if (!cancelled) setStatus('error');
          return;
        }
        const data = await res.json();
        const snap = normalizeSharedSnapshot(data);
        if (!snap) {
          if (!cancelled) setStatus('error');
          return;
        }
        if (!cancelled) {
          setSnapshot(snap);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  const store = useMemo(
    () =>
      snapshot
        ? createBattlesStore({
            storage: createSnapshotStorage(sharedSnapshotToAppStorage(snapshot)),
          })
        : null,
    [snapshot],
  );

  if (status === 'loading') {
    return <Centered>読み込み中...</Centered>;
  }
  if (status === 'notfound') {
    return (
      <Centered>
        <p className="mb-3">共有された戦績が見つかりませんでした。</p>
        <Link to="/record" className="text-brand-action hover:underline">
          duel-tools を開く
        </Link>
      </Centered>
    );
  }
  if (status === 'error' || !store || !snapshot) {
    return (
      <Centered>
        <p className="mb-3">共有データの読み込みに失敗しました。</p>
        <Link to="/record" className="text-brand-action hover:underline">
          duel-tools を開く
        </Link>
      </Centered>
    );
  }

  return (
    <BattlesStoreContext.Provider value={store}>
      <div className="min-h-screen flex flex-col bg-brand-canvas text-brand-ink">
        <header className="border-b border-brand-cyan/30 bg-brand-surface px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <BrandLogo />
              <div className="mt-2">
                <h1 className="truncate text-lg font-bold text-brand-ink">
                  {snapshot.title || '共有された戦績'}
                </h1>
                <p className="text-xs text-gray-600">
                  読み取り専用
                  {snapshot.createdAt && `・公開日時 ${formatDate(snapshot.createdAt)}`}
                </p>
              </div>
            </div>
            <Link
              to="/record"
              className="shrink-0 rounded-lg border border-brand-action px-3 py-1.5 text-sm font-medium text-brand-action transition-colors hover:bg-brand-soft"
            >
              自分の記録を始める
            </Link>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <SharedDashboard />
        </main>
      </div>
    </BattlesStoreContext.Provider>
  );
}

function SharedDashboard() {
  const { items: records } = useRecords();
  const { items: ownDecks } = useOwnDecks();
  const { items: opponentDecks } = useOpponentDecks();
  const [includeGrantedFirst, setIncludeGrantedFirst] = useState(false);
  const { filter, filtered, updateFilter, resetFilter } = useFilter(records);
  const { overall, asFirst, asSecond, deckStats, opponentDeckStats, matchupCells } =
    useStats(filtered, ownDecks, opponentDecks, includeGrantedFirst);

  if (records.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          title="戦績がありません"
          description="この共有には対戦記録が含まれていません。"
        />
      </div>
    );
  }

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="flex flex-col gap-4 p-4 max-w-5xl mx-auto">
      <FilterBar
        filter={filter}
        onChange={updateFilter}
        onReset={resetFilter}
        ownDecks={ownDecks}
        opponentDecks={opponentDecks}
      />
      <div className="flex items-center gap-2">
        <input
          id="shared-include-granted-first"
          type="checkbox"
          checked={includeGrantedFirst}
          onChange={(e) => setIncludeGrantedFirst(e.target.checked)}
          className="w-4 h-4 accent-brand-action"
        />
        <label
          htmlFor="shared-include-granted-first"
          className="text-sm text-gray-600 select-none cursor-pointer"
        >
          ゆずられ先攻を先攻に含める
        </label>
      </div>
      <OverallSummaryCard overall={overall} asFirst={asFirst} asSecond={asSecond} />
      <OpponentDeckDistribution opponentDeckStats={opponentDeckStats} />
      <OpponentDeckStatsTable opponentDeckStats={opponentDeckStats} />
      <DeckStatsTable deckStats={deckStats} />
      <MatchupTable
        matchupCells={matchupCells}
        ownDecks={ownDecks}
        opponentDecks={opponentDecks}
      />
      <DPTransitionChart records={filtered} />
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          対戦履歴（{sorted.length} 件）
        </h2>
        {sorted.length > 0 ? (
          <RecordTable records={sorted} onDetailClick={() => {}} readOnly />
        ) : (
          <EmptyState
            title="該当なし"
            description="条件に一致する戦績が見つかりませんでした。"
          />
        )}
      </div>
    </div>
  );
}
