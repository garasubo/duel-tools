export type DeckCounts = Record<string, number>;
export type Pattern = Record<string, number>;
export type Patterns = Pattern[];

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

export function validateDeck(deckCounts: DeckCounts): void {
  let total = 0;
  for (const [name, count] of Object.entries(deckCounts)) {
    if (count < 0) {
      throw new Error(`カード "${name}" の枚数が負の値です: ${count}`);
    }
    total += count;
  }
  if (total !== 40) {
    throw new Error(`デッキの合計枚数が40枚ではありません: ${total}枚`);
  }
}

export function matchesPattern(
  handCounts: DeckCounts,
  pattern: Pattern,
  deckCounts: DeckCounts,
): boolean {
  for (const [cardName, required] of Object.entries(pattern)) {
    if (!(cardName in deckCounts)) {
      throw new Error(
        `条件にデッキに存在しないカードが含まれています: "${cardName}"`,
      );
    }
    const inHand = handCounts[cardName] ?? 0;
    if (inHand < required) return false;
  }
  return true;
}

export function isPlayable(
  handCounts: DeckCounts,
  patterns: Patterns,
  deckCounts: DeckCounts,
): boolean {
  return patterns.some((pattern) =>
    matchesPattern(handCounts, pattern, deckCounts),
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
): StarterRateResult {
  const total = Object.values(deckCounts).reduce((s, n) => s + n, 0);
  const paddedDeck: DeckCounts =
    total < 40 ? { ...deckCounts, __dummy__: 40 - total } : { ...deckCounts };

  validateDeck(paddedDeck);

  // パターン内のカード名がデッキに存在するか事前チェック
  for (const pattern of patterns) {
    for (const cardName of Object.keys(pattern)) {
      if (!(cardName in deckCounts)) {
        throw new Error(
          `条件にデッキに存在しないカードが含まれています: "${cardName}"`,
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

  const totalHands = combination(40, 5);
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
      if (isPlayable(hand, patterns, deckCounts)) {
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
