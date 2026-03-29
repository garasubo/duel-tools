import { describe, it, expect } from "vitest";
import {
  combination,
  validateDeck,
  matchesPattern,
  isPlayable,
  countWays,
  calculateStarterRate,
  type Patterns,
} from "./starterRate";

describe("combination", () => {
  it("C(5,2) = 10", () => {
    expect(combination(5, 2)).toBe(10);
  });

  it("C(40,5) = 658008", () => {
    expect(combination(40, 5)).toBe(658008);
  });

  it("C(n,0) = 1", () => {
    expect(combination(10, 0)).toBe(1);
  });

  it("C(n,n) = 1", () => {
    expect(combination(7, 7)).toBe(1);
  });

  it("k > n のとき 0", () => {
    expect(combination(3, 5)).toBe(0);
  });

  it("k < 0 のとき 0", () => {
    expect(combination(5, -1)).toBe(0);
  });
});

describe("validateDeck", () => {
  it("合計40枚なら通る", () => {
    expect(() => validateDeck({ A: 3, others: 37 })).not.toThrow();
  });

  it("合計41枚以上の場合はエラー", () => {
    expect(() => validateDeck({ A: 3, others: 38 })).toThrow();
  });

  it("負の枚数はエラー", () => {
    expect(() => validateDeck({ A: -1, others: 41 })).toThrow();
  });
});

describe("matchesPattern", () => {
  const deck = { A: 3, B: 3, others: 34 };

  it("条件を満たす", () => {
    expect(matchesPattern({ A: 1, B: 0, others: 4 }, { A: 1 }, deck)).toBe(
      true,
    );
  });

  it("条件を満たさない（枚数不足）", () => {
    expect(matchesPattern({ A: 0, B: 2, others: 3 }, { A: 1 }, deck)).toBe(
      false,
    );
  });

  it("複数条件を満たす", () => {
    expect(
      matchesPattern({ A: 1, B: 1, others: 3 }, { A: 1, B: 1 }, deck),
    ).toBe(true);
  });

  it("デッキに存在しないカードはエラー", () => {
    expect(() => matchesPattern({ A: 1, others: 4 }, { X: 1 }, deck)).toThrow();
  });
});

describe("isPlayable", () => {
  const deck = { A: 3, B: 3, others: 34 };

  it("いずれかの条件を満たせば true", () => {
    const hand = { A: 0, B: 1, others: 4 };
    expect(isPlayable(hand, [{ A: 1 }, { B: 1 }], deck)).toBe(true);
  });

  it("どの条件も満たさなければ false", () => {
    const hand = { A: 0, B: 0, others: 5 };
    expect(isPlayable(hand, [{ A: 1 }, { B: 1 }], deck)).toBe(false);
  });
});

describe("countWays", () => {
  it("C(3,1)*C(37,4) の積を返す", () => {
    const deck = { A: 3, others: 37 };
    const hand = { A: 1, others: 4 };
    // C(3,1) = 3, C(37,4) = 66045
    expect(countWays(deck, hand)).toBe(combination(3, 1) * combination(37, 4));
  });
});

describe("calculateStarterRate", () => {
  // 12.1 単純1枚初動
  // デッキ: A:3, others:37
  // 条件: {A:1}
  // 成功手 = C(40,5) - C(37,5) = 658008 - 435897 = 222111
  it("12.1 単純1枚初動: 理論値と一致する", () => {
    const deck = { A: 3, others: 37 };
    const patterns = [{ A: 1 }];
    const result = calculateStarterRate(deck, patterns);
    const expected = combination(40, 5) - combination(37, 5);
    expect(result.successHands).toBe(expected);
    expect(result.totalHands).toBe(combination(40, 5));
    expect(result.rate).toBeCloseTo(expected / combination(40, 5));
  });

  // 12.2 2枚要求
  // デッキ: A:3, B:3, others:34
  // 条件: {A:1, B:1}
  // 成功手 = C(40,5) - C(37,5)_noA - C(37,5)_noB + C(34,5)_noAnoB
  //        = 658008 - 435897 - 435897 + 278256 = 64470
  it("12.2 2枚要求: 理論値と一致する", () => {
    const deck = { A: 3, B: 3, others: 34 };
    const patterns = [{ A: 1, B: 1 }];
    const result = calculateStarterRate(deck, patterns);
    const expected =
      combination(40, 5) -
      combination(37, 5) -
      combination(37, 5) +
      combination(34, 5);
    expect(result.successHands).toBe(expected);
  });

  // 12.3 複数条件OR（重複カウントなし）
  // デッキ: A:3, B:3, C:3, others:31
  // 条件: [{A:1}, {B:1,C:1}]
  // |A>=1| = C(40,5) - C(37,5) = 222111
  // |B>=1 and C>=1| = C(40,5) - C(37,5)_noB - C(37,5)_noC + C(34,5)_noBnoC = 64470
  // |A>=1 and B>=1 and C>=1| = C(40,5) - 3*C(37,5) + 3*C(34,5) - C(31,5) = 15174
  // 成功手 = 222111 + 64470 - 15174 = 271407
  it("12.3 複数条件OR: 重複カウントなし", () => {
    const deck = { A: 3, B: 3, C: 3, others: 31 };
    const patterns: Patterns = [{ A: 1 }, { B: 1, C: 1 }];
    const result = calculateStarterRate(deck, patterns);
    const c40_5 = combination(40, 5);
    const c37_5 = combination(37, 5);
    const c34_5 = combination(34, 5);
    const c31_5 = combination(31, 5);
    const withA = c40_5 - c37_5;
    const withBC = c40_5 - 2 * c37_5 + c34_5;
    const withABC = c40_5 - 3 * c37_5 + 3 * c34_5 - c31_5;
    const expected = withA + withBC - withABC;
    expect(result.successHands).toBe(expected);
  });

  // 12.4 同名複数要求
  // デッキ: A:3, others:37
  // 条件: {A:2}
  // 成功手 = C(3,2)*C(37,3) + C(3,3)*C(37,2) = 3*7770 + 1*666 = 23976
  it("12.4 同名複数要求: A2枚以上", () => {
    const deck = { A: 3, others: 37 };
    const patterns = [{ A: 2 }];
    const result = calculateStarterRate(deck, patterns);
    const expected =
      combination(3, 2) * combination(37, 3) +
      combination(3, 3) * combination(37, 2);
    expect(result.successHands).toBe(expected);
  });

  // 12.5 40枚未満のデッキはダミー補完して計算
  it("12.5 40枚未満のデッキはダミーで補完される", () => {
    // A:3, others:36 = 39枚 → __dummy__:1 で補完して計算
    // 成功手 = C(40,5) - C(37,5) = 222111 (A未含有手を除外)
    const deck = { A: 3, others: 36 };
    const result = calculateStarterRate(deck, [{ A: 1 }]);
    const expected = combination(40, 5) - combination(37, 5);
    expect(result.successHands).toBe(expected);
    expect(result.totalHands).toBe(combination(40, 5));
  });

  // 12.5 異常系
  it("12.5 合計40枚超過のデッキはエラー", () => {
    expect(() =>
      calculateStarterRate({ A: 3, others: 38 }, [{ A: 1 }]),
    ).toThrow();
  });

  it("12.5 負の枚数はエラー", () => {
    expect(() =>
      calculateStarterRate({ A: -1, others: 41 }, [{ A: 1 }]),
    ).toThrow();
  });

  it("12.5 条件にデッキ外カードはエラー", () => {
    expect(() =>
      calculateStarterRate({ A: 3, others: 37 }, [{ X: 1 }]),
    ).toThrow();
  });
});
