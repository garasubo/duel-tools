import { useState } from "react";
import type {
  DeckCounts,
  Patterns,
  Pattern,
  StarterRateResult,
} from "../utils/starterRate";
import { calculateStarterRate } from "../utils/starterRate";
import DeckEditor from "../components/combo/DeckEditor";
import PatternEditor from "../components/combo/PatternEditor";
import Button from "../components/ui/Button";

export default function ComboPage() {
  const [deckCounts, setDeckCounts] = useState<DeckCounts>({});
  const [deckSize, setDeckSize] = useState(40);
  const [patterns, setPatterns] = useState<Patterns>([]);
  const [result, setResult] = useState<StarterRateResult | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);

  const deckTotal = Object.values(deckCounts).reduce((s, n) => s + n, 0);
  const canCalculate =
    deckTotal > 0 && deckTotal <= deckSize && patterns.length > 0;

  function resetResult() {
    setResult(null);
    setCalcError(null);
  }

  function handleAddCard(name: string, count: number) {
    setDeckCounts((prev) => ({ ...prev, [name]: count }));
    resetResult();
  }

  function handleRemoveCard(name: string) {
    setDeckCounts((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setPatterns((prev) =>
      prev.map((pattern) => {
        const next = { ...pattern };
        delete next[name];
        return next;
      }),
    );
    resetResult();
  }

  function handleCardCountChange(name: string, count: number) {
    setDeckCounts((prev) => ({ ...prev, [name]: count }));
    setPatterns((prev) =>
      prev.map((pattern) => {
        if (!(name in pattern)) return pattern;
        const clamped = Math.min(pattern[name], count);
        return { ...pattern, [name]: clamped };
      }),
    );
    resetResult();
  }

  function handleAddPattern() {
    setPatterns((prev) => [...prev, {}]);
    resetResult();
  }

  function handleRemovePattern(index: number) {
    setPatterns((prev) => prev.filter((_, i) => i !== index));
    resetResult();
  }

  function handleUpdatePattern(index: number, pattern: Pattern) {
    setPatterns((prev) => prev.map((p, i) => (i === index ? pattern : p)));
    resetResult();
  }

  function handleDeckSizeChange(size: number) {
    setDeckSize(size);
    resetResult();
  }

  function handleCalculate() {
    try {
      const res = calculateStarterRate(deckCounts, patterns, deckSize);
      setResult(res);
      setCalcError(null);
    } catch (e) {
      setCalcError(e instanceof Error ? e.message : "計算エラーが発生しました");
      setResult(null);
    }
  }

  const ratePercent = result ? (result.rate * 100).toFixed(1) : null;
  const rateColor =
    result === null
      ? "text-indigo-600"
      : result.rate >= 0.5
        ? "text-emerald-600"
        : result.rate >= 0.3
          ? "text-amber-600"
          : "text-red-600";
  const barColor =
    result === null
      ? "bg-indigo-500"
      : result.rate >= 0.5
        ? "bg-emerald-500"
        : result.rate >= 0.3
          ? "bg-amber-500"
          : "bg-red-500";

  return (
    <div className="p-4 max-w-3xl mx-auto flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DeckEditor
          deckCounts={deckCounts}
          deckSize={deckSize}
          onDeckSizeChange={handleDeckSizeChange}
          onAdd={handleAddCard}
          onRemove={handleRemoveCard}
          onCountChange={handleCardCountChange}
        />
        <PatternEditor
          patterns={patterns}
          deckCounts={deckCounts}
          onAddPattern={handleAddPattern}
          onRemovePattern={handleRemovePattern}
          onUpdatePattern={handleUpdatePattern}
        />
      </div>

      <div className="flex flex-col items-stretch gap-2">
        <Button
          variant="primary"
          size="lg"
          onClick={handleCalculate}
          disabled={!canCalculate}
          className="w-full"
        >
          確率を計算する
        </Button>
        {!canCalculate && (
          <p className="text-xs text-gray-400 text-center">
            {deckTotal > deckSize
              ? `デッキ枚数が ${deckTotal}/${deckSize} 枚です（${deckSize}枚を超えています）`
              : patterns.length === 0
                ? "カードと条件を追加してください"
                : "カードを1枚以上追加してください"}
          </p>
        )}
        {canCalculate && deckTotal < deckSize && (
          <p className="text-xs text-gray-400 text-center">
            残り {deckSize - deckTotal} 枚はダミーカードとして扱います
          </p>
        )}
      </div>

      {(result !== null || calcError !== null) && (
        <div
          className={`bg-white rounded-xl border shadow-sm p-6 ${calcError ? "border-red-300" : "border-gray-200"}`}
        >
          {calcError ? (
            <p className="text-sm text-red-600">{calcError}</p>
          ) : (
            result && (
              <div className="flex flex-col gap-3">
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-5xl font-bold tabular-nums ${rateColor}`}
                  >
                    {ratePercent}%
                  </span>
                  <span className="text-sm text-gray-500">初動率</span>
                </div>

                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${result.rate * 100}%` }}
                  />
                </div>

                <p className="text-sm text-gray-500">
                  {result.successHands.toLocaleString()} /{" "}
                  {result.totalHands.toLocaleString()} 通り
                </p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
