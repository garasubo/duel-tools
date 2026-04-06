export type DeckCounts = Record<string, number>;

export type PatternEntry =
  | { type: 'card'; name: string; required: number }
  | { type: 'label'; label: string; required: number };

export type Pattern = PatternEntry[];
export type Patterns = Pattern[];

export type CardLabels = Record<string, string[]>;

export interface StarterRateResult {
  successHands: number;
  totalHands: number;
  rate: number;
}

export function combination(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const k2 = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < k2; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}

export function validateDeck(deckCounts: DeckCounts, deckSize: number): void {
  let total = 0;
  for (const [name, count] of Object.entries(deckCounts)) {
    if (count < 0) {
      throw new Error(`カード "${name}" の枚数が負の値です: ${count}`);
    }
    total += count;
  }
  if (total !== deckSize) {
    throw new Error(`デッキの合計枚数が${deckSize}枚ではありません: ${total}枚`);
  }
}

export function getAllLabels(cardLabels: CardLabels): string[] {
  const set = new Set<string>();
  for (const labels of Object.values(cardLabels)) {
    for (const lbl of labels) set.add(lbl);
  }
  return [...set].sort();
}

export function getCardsForLabel(label: string, cardLabels: CardLabels): string[] {
  return Object.entries(cardLabels)
    .filter(([, labels]) => labels.includes(label))
    .map(([name]) => name);
}

export function matchesPattern(
  handCounts: DeckCounts,
  pattern: Pattern,
  deckCounts: DeckCounts,
  cardLabels: CardLabels = {},
): boolean {
  for (const entry of pattern) {
    if (entry.type === 'card') {
      if (!(entry.name in deckCounts)) {
        throw new Error(
          `条件にデッキに存在しないカードが含まれています: "${entry.name}"`,
        );
      }
      const inHand = handCounts[entry.name] ?? 0;
      if (inHand < entry.required) return false;
    } else {
      const members = getCardsForLabel(entry.label, cardLabels);
      const inHand = members.reduce((sum, card) => sum + (handCounts[card] ?? 0), 0);
      if (inHand < entry.required) return false;
    }
  }
  return true;
}

export function isPlayable(
  handCounts: DeckCounts,
  patterns: Patterns,
  deckCounts: DeckCounts,
  cardLabels: CardLabels = {},
): boolean {
  return patterns.some((pattern) =>
    matchesPattern(handCounts, pattern, deckCounts, cardLabels),
  );
}

export function countWays(
  deckCounts: DeckCounts,
  handCounts: DeckCounts,
): number {
  let ways = 1;
  for (const [cardName, deckCount] of Object.entries(deckCounts)) {
    const handCount = handCounts[cardName] ?? 0;
    ways *= combination(deckCount, handCount);
  }
  return ways;
}

export function calculateStarterRate(
  deckCounts: DeckCounts,
  patterns: Patterns,
  deckSize: number = 40,
  cardLabels: CardLabels = {},
): StarterRateResult {
  const total = Object.values(deckCounts).reduce((s, n) => s + n, 0);
  const paddedDeck: DeckCounts =
    total < deckSize
      ? { ...deckCounts, __dummy__: deckSize - total }
      : { ...deckCounts };

  validateDeck(paddedDeck, deckSize);

  // パターン内のカード名がデッキに存在するか事前チェック
  for (const pattern of patterns) {
    for (const entry of pattern) {
      if (entry.type === 'card' && !(entry.name in deckCounts)) {
        throw new Error(
          `条件にデッキに存在しないカードが含まれています: "${entry.name}"`,
        );
      }
    }
  }

  const cards = Object.keys(paddedDeck);
  const deck = cards.map((c) => paddedDeck[c]);
  const handArr = new Array<number>(cards.length).fill(0);

  // 枝刈り用: index以降のデッキ採用枚数の累計
  const suffixSum = new Array<number>(cards.length + 1).fill(0);
  for (let i = cards.length - 1; i >= 0; i--) {
    suffixSum[i] = suffixSum[i + 1] + deck[i];
  }

  const totalHands = combination(deckSize, 5);
  let successHands = 0;

  function buildHandCounts(): DeckCounts {
    const hand: DeckCounts = {};
    for (let i = 0; i < cards.length; i++) {
      hand[cards[i]] = handArr[i];
    }
    return hand;
  }

  function dfs(index: number, remaining: number): void {
    if (remaining === 0) {
      const hand = buildHandCounts();
      if (isPlayable(hand, patterns, deckCounts, cardLabels)) {
        successHands += countWays(paddedDeck, hand);
      }
      return;
    }
    if (index === cards.length) return;

    // 枝刈り: 残りカード全部引いても足りない場合
    if (suffixSum[index] < remaining) return;

    const maxTake = Math.min(deck[index], remaining);
    for (let take = 0; take <= maxTake; take++) {
      handArr[index] = take;
      dfs(index + 1, remaining - take);
    }
    handArr[index] = 0;
  }

  dfs(0, 5);

  return {
    successHands,
    totalHands,
    rate: successHands / totalHands,
  };
}
