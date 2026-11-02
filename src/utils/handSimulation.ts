import type { DeckCounts } from './starterRate';

export const MAX_SIMULATION_COUNT = 1000;
export const SIMULATED_HAND_SIZE = 5;
// null distinguishes dummy cards from every user-supplied card name.
export type SimulatedHand = (string | null)[];

export function getSimulationDeckError(deckCounts: DeckCounts, deckSize: number): string | null {
  if (!Number.isSafeInteger(deckSize) || deckSize < SIMULATED_HAND_SIZE) {
    return 'デッキ枚数は5以上の整数にしてください';
  }
  const counts = Object.values(deckCounts);
  if (counts.some((count) => !Number.isSafeInteger(count) || count < 0)) {
    return 'カードの枚数は0以上の整数にしてください';
  }
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total === 0) return 'カードを1枚以上追加してください';
  if (total > deckSize) return `カードの合計枚数がデッキ枚数（${deckSize}枚）を超えています`;
  return null;
}

export function getSimulationCountError(count: number): string | null {
  return Number.isInteger(count) && count >= 1 && count <= MAX_SIMULATION_COUNT
    ? null
    : `回数は1〜${MAX_SIMULATION_COUNT.toLocaleString()}の整数にしてください`;
}

export function simulateHands(
  deckCounts: DeckCounts,
  deckSize: number,
  count: number,
  random: () => number = Math.random,
): SimulatedHand[] {
  const error = getSimulationDeckError(deckCounts, deckSize) ?? getSimulationCountError(count);
  if (error) throw new Error(error);

  const cards: (string | null)[] = Object.keys(deckCounts);
  const counts = Object.values(deckCounts);
  const total = counts.reduce((sum, n) => sum + n, 0);
  if (total < deckSize) {
    cards.push(null);
    counts.push(deckSize - total);
  }

  return Array.from({ length: count }, () => {
    const remaining = [...counts];
    const hand: SimulatedHand = [];
    for (let draw = 0; draw < SIMULATED_HAND_SIZE; draw++) {
      // Every remaining physical copy occupies one equally likely position.
      let position = Math.floor(random() * (deckSize - draw));
      for (let i = 0; i < cards.length; i++) {
        if (position < remaining[i]) {
          hand.push(cards[i]);
          remaining[i]--;
          break;
        }
        position -= remaining[i];
      }
    }
    return hand;
  });
}
