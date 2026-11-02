import { describe, expect, it } from 'vitest';
import { matchesPattern, type DeckCounts } from './starterRate';
import { getSimulationDeckError, simulateHands } from './handSimulation';

describe('simulateHands', () => {
  it('指定回数だけ5枚を引き、毎回デッキを復元する', () => {
    const deck = { A: 2, B: 3 };
    expect(simulateHands(deck, 5, 3, () => 0)).toEqual([
      ['A', 'A', 'B', 'B', 'B'],
      ['A', 'A', 'B', 'B', 'B'],
      ['A', 'A', 'B', 'B', 'B'],
    ]);
    expect(deck).toEqual({ A: 2, B: 3 });
  });

  it('残りの実カード枚数に比例した位置を抽選する', () => {
    const values = [0.29, 0.3, 0.99, 0, 0];
    expect(simulateHands({ A: 3, B: 7 }, 10, 1, () => values.shift()!)).toEqual([
      ['A', 'B', 'B', 'A', 'A'],
    ]);
  });

  it('未入力分をダミーで補完し、ダミーに似たカード名と区別する', () => {
    expect(simulateHands({ __dummy__: 1, ダミーカード: 1 }, 5, 1, () => 0)).toEqual([
      ['__dummy__', 'ダミーカード', null, null, null],
    ]);
    expect(simulateHands({ A: 1 }, 40, 1, () => 0.999)).toEqual([
      [null, null, null, null, null],
    ]);
  });

  it('多数回の抽選でも手札が5枚で採用枚数を超えない', () => {
    const hands = simulateHands({ A: 1, B: 3, C: 2 }, 40, 1000);
    expect(hands).toHaveLength(1000);
    for (const hand of hands) {
      expect(hand).toHaveLength(5);
      expect(hand.filter((card) => card === 'A').length).toBeLessThanOrEqual(1);
      expect(hand.filter((card) => card === 'B').length).toBeLessThanOrEqual(3);
      expect(hand.filter((card) => card === 'C').length).toBeLessThanOrEqual(2);
    }
  });

  it.each([0, -1, 1.5, 1001, NaN, Infinity])('不正な回数 %s を拒否する', (count) => {
    expect(() => simulateHands({ A: 3 }, 40, count)).toThrow('回数は');
  });

  it.each<{ deck: DeckCounts; size: number }>([
    { deck: {}, size: 40 },
    { deck: { A: 0 }, size: 40 },
    { deck: { A: 6 }, size: 5 },
    { deck: { A: 1 }, size: 4 },
    { deck: { A: 1 }, size: 40.5 },
    { deck: { A: 1 }, size: Infinity },
    { deck: { A: 1.5 }, size: 40 },
    { deck: { A: -1 }, size: 40 },
    { deck: { A: NaN }, size: 40 },
    { deck: { A: Infinity }, size: 40 },
  ])('不正なデッキ $deck / $size を拒否する', ({ deck, size }) => {
    expect(getSimulationDeckError(deck, size)).not.toBeNull();
    expect(() => simulateHands(deck, size, 1)).toThrow();
  });

  it('生成した手札でカード条件・ラベル条件を既存ルールで判定できる', () => {
    const deck = { A: 1, B: 1, C: 3 };
    const [hand] = simulateHands(deck, 5, 1, () => 0);
    const counts = Object.fromEntries(Object.keys(deck).map((name) => [name, hand.filter((c) => c === name).length]));
    const labels = { A: ['初動'], B: ['初動'] };
    expect(matchesPattern(counts, [{ type: 'card', name: 'A', required: 1 }], deck)).toBe(true);
    expect(matchesPattern(counts, [{ type: 'label', label: '初動', required: 2 }], deck, labels)).toBe(true);
    expect(matchesPattern(counts, [
      { type: 'card', name: 'A', required: 1 },
      { type: 'label', label: '初動', required: 2 },
    ], deck, labels)).toBe(false);
  });
});
