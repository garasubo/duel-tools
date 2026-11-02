import { useState } from 'react';
import type { CardLabels, DeckCounts, Patterns } from '../../utils/starterRate';
import { matchesPattern } from '../../utils/starterRate';
import {
  getSimulationCountError,
  getSimulationDeckError,
  MAX_SIMULATION_COUNT,
  simulateHands,
  type SimulatedHand,
} from '../../utils/handSimulation';
import Button from '../ui/Button';

interface Props {
  deckCounts: DeckCounts;
  deckSize: number;
  patterns: Patterns;
  cardLabels: CardLabels;
}

export interface SimulationRow {
  hand: SimulatedHand;
  matchedPatterns: number[];
}

const PAGE_SIZE = 50;

export function SimulationResults({ rows, hasPatterns, page, onPageChange }: {
  rows: SimulationRow[];
  hasPatterns: boolean;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.ceil(rows.length / PAGE_SIZE);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-600" role="status">{rows.length.toLocaleString()}回の結果（初手5枚）</p>
      <ol start={page * PAGE_SIZE + 1} className="flex flex-col gap-2" aria-label="シミュレートした手札">
        {rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((row, index) => (
          <li key={page * PAGE_SIZE + index} className="rounded-lg border border-gray-200 p-3 min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 text-xs">
              <span className="text-gray-500">{page * PAGE_SIZE + index + 1}回目</span>
              <span className={row.matchedPatterns.length > 0 ? 'text-emerald-700' : 'text-gray-500'}>
                {!hasPatterns ? '条件未設定' : row.matchedPatterns.length === 0 ? '成立なし' : `成立: ${row.matchedPatterns.map((n) => `条件 ${n}`).join('、')}`}
              </span>
            </div>
            <ul className="flex flex-wrap gap-2" aria-label="手札5枚">
              {row.hand.map((card, i) => (
                <li key={i} className={`max-w-full break-all rounded-lg border px-2 py-1 text-sm ${card === null ? 'bg-gray-50 border-gray-200 text-gray-500' : 'bg-brand-soft border-brand-cyan/30 text-brand-ink'}`}>
                  {card ?? 'ダミーカード'}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {pageCount > 1 && (
        <nav aria-label="手札一覧のページ切り替え" className="flex items-center justify-between gap-2">
          <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)}>前へ</Button>
          <span className="text-sm text-gray-500">{page + 1} / {pageCount}ページ</span>
          <Button variant="secondary" size="sm" disabled={page + 1 === pageCount} onClick={() => onPageChange(page + 1)}>次へ</Button>
        </nav>
      )}
    </div>
  );
}

export default function HandSimulator(props: Props) {
  const { deckCounts, deckSize, patterns, cardLabels } = props;
  const [count, setCount] = useState('10');
  const [page, setPage] = useState(0);
  const [config, setConfig] = useState(props);
  const [result, setResult] = useState<{ rows: SimulationRow[]; error: string | null } | null>(null);
  // Clear before rendering children, retaining the user's requested trial count.
  if (config.deckCounts !== deckCounts || config.deckSize !== deckSize ||
    config.patterns !== patterns || config.cardLabels !== cardLabels) {
    setConfig(props);
    setResult(null);
    setPage(0);
  }
  const deckError = getSimulationDeckError(deckCounts, deckSize);
  const countError = getSimulationCountError(Number(count));
  const inputError = deckError ?? countError;
  const deckTotal = Object.values(deckCounts).reduce((sum, n) => sum + n, 0);

  function handleSimulate() {
    if (inputError) return;
    try {
      const rows = simulateHands(deckCounts, deckSize, Number(count)).map((hand) => {
        const handCounts: DeckCounts = Object.create(null);
        for (const card of hand) {
          if (card !== null) handCounts[card] = (handCounts[card] ?? 0) + 1;
        }
        const matchedPatterns = patterns.flatMap((pattern, i) =>
          matchesPattern(handCounts, pattern, deckCounts, cardLabels) ? [i + 1] : [],
        );
        return { hand, matchedPatterns };
      });
      setResult({ rows, error: null });
    } catch (error) {
      setResult({ rows: [], error: error instanceof Error ? error.message : 'シミュレートに失敗しました' });
    }
    setPage(0);
  }

  return (
    <section aria-labelledby="hand-simulator-heading" className="bg-white rounded-xl border border-gray-200 shadow-sm min-w-0">
      <h2 id="hand-simulator-heading" className="text-sm font-semibold text-gray-900 px-4 py-3 border-b border-gray-100">手札シミュレート</h2>
      <div className="p-4 flex flex-col gap-4">
        <p className="text-sm text-gray-500">毎回デッキを元に戻して、ランダムな初手5枚を指定回数分表示します。条件未設定でも利用できます。</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="hand-simulation-count" className="text-xs text-gray-600">回数（1〜1,000）</label>
            <input id="hand-simulation-count" type="number" min={1} max={MAX_SIMULATION_COUNT} step={1} value={count}
              onChange={(event) => setCount(event.target.value)} aria-invalid={!!countError} aria-describedby={inputError ? 'hand-simulation-error' : undefined}
              className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-action" />
          </div>
          <Button onClick={handleSimulate} disabled={!!inputError}>シミュレートする</Button>
        </div>
        {inputError && <p id="hand-simulation-error" className="text-xs text-red-600">{inputError}</p>}
        {!deckError && deckTotal < deckSize && <p className="text-xs text-gray-500">残り {deckSize - deckTotal} 枚はダミーカードとして扱います</p>}
        {result?.error && <p role="alert" className="text-sm text-red-600">{result.error}</p>}
        {result && !result.error && <SimulationResults rows={result.rows} hasPatterns={patterns.length > 0} page={page} onPageChange={setPage} />}
      </div>
    </section>
  );
}
