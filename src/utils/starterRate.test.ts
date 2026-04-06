import { describe, it, expect } from "vitest";
import {
  combination,
  validateDeck,
  matchesPattern,
  isPlayable,
  countWays,
  calculateStarterRate,
  type Patterns,
  type CardLabels,
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
    expect(() => validateDeck({ A: 3, others: 37 }, 40)).not.toThrow();
  });

  it("合計41枚以上の場合はエラー", () => {
    expect(() => validateDeck({ A: 3, others: 38 }, 40)).toThrow();
  });

  it("負の枚数はエラー", () => {
    expect(() => validateDeck({ A: -1, others: 41 }, 40)).toThrow();
  });

  it("合計60枚でdeckSize=60なら通る", () => {
    expect(() => validateDeck({ A: 3, others: 57 }, 60)).not.toThrow();
  });
});

describe("matchesPattern", () => {
  const deck = { A: 3, B: 3, others: 34 };

  it("条件を満たす", () => {
    expect(
      matchesPattern(
        { A: 1, B: 0, others: 4 },
        [{ type: "card", name: "A", required: 1 }],
        deck,
      ),
    ).toBe(true);
  });

  it("条件を満たさない（枚数不足）", () => {
    expect(
      matchesPattern(
        { A: 0, B: 2, others: 3 },
        [{ type: "card", name: "A", required: 1 }],
        deck,
      ),
    ).toBe(false);
  });

  it("複数条件を満たす", () => {
    expect(
      matchesPattern(
        { A: 1, B: 1, others: 3 },
        [
          { type: "card", name: "A", required: 1 },
          { type: "card", name: "B", required: 1 },
        ],
        deck,
      ),
    ).toBe(true);
  });

  it("デッキに存在しないカードはエラー", () => {
    expect(() =>
      matchesPattern(
        { A: 1, others: 4 },
        [{ type: "card", name: "X", required: 1 }],
        deck,
      ),
    ).toThrow();
  });

  describe("ラベル条件", () => {
    const cardLabels: CardLabels = { A: ["初動"], B: ["初動"] };

    it("ラベル条件: A+Bの合計 >= 1 で成立する（Bのみ手札にある場合）", () => {
      expect(
        matchesPattern(
          { A: 0, B: 1, others: 4 },
          [{ type: "label", label: "初動", required: 1 }],
          deck,
          cardLabels,
        ),
      ).toBe(true);
    });

    it("ラベル条件: A+Bの合計 == 0 で不成立", () => {
      expect(
        matchesPattern(
          { A: 0, B: 0, others: 5 },
          [{ type: "label", label: "初動", required: 1 }],
          deck,
          cardLabels,
        ),
      ).toBe(false);
    });

    it("ラベル条件: 2枚以上要求 - A:1+B:1で成立", () => {
      expect(
        matchesPattern(
          { A: 1, B: 1, others: 3 },
          [{ type: "label", label: "初動", required: 2 }],
          deck,
          cardLabels,
        ),
      ).toBe(true);
    });

    it("ラベル条件: 2枚以上要求 - A:1のみで不成立", () => {
      expect(
        matchesPattern(
          { A: 1, B: 0, others: 4 },
          [{ type: "label", label: "初動", required: 2 }],
          deck,
          cardLabels,
        ),
      ).toBe(false);
    });

    it("ラベルにカードが0枚の場合は常に不成立", () => {
      expect(
        matchesPattern(
          { A: 1, others: 4 },
          [{ type: "label", label: "存在しない", required: 1 }],
          deck,
          cardLabels,
        ),
      ).toBe(false);
    });

    it("カード条件とラベル条件の混在", () => {
      expect(
        matchesPattern(
          { A: 2, B: 0, others: 3 },
          [
            { type: "card", name: "A", required: 1 },
            { type: "label", label: "初動", required: 2 },
          ],
          deck,
          cardLabels,
        ),
      ).toBe(true);
    });
  });
});

describe("isPlayable", () => {
  const deck = { A: 3, B: 3, others: 34 };

  it("いずれかの条件を満たせば true", () => {
    const hand = { A: 0, B: 1, others: 4 };
    expect(
      isPlayable(
        hand,
        [
          [{ type: "card", name: "A", required: 1 }],
          [{ type: "card", name: "B", required: 1 }],
        ],
        deck,
      ),
    ).toBe(true);
  });

  it("どの条件も満たさなければ false", () => {
    const hand = { A: 0, B: 0, others: 5 };
    expect(
      isPlayable(
        hand,
        [
          [{ type: "card", name: "A", required: 1 }],
          [{ type: "card", name: "B", required: 1 }],
        ],
        deck,
      ),
    ).toBe(false);
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
    const patterns: Patterns = [[{ type: "card", name: "A", required: 1 }]];
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
    const patterns: Patterns = [
      [
        { type: "card", name: "A", required: 1 },
        { type: "card", name: "B", required: 1 },
      ],
    ];
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
  it("12.3 複数条件OR: 重複カウントなし", () => {
    const deck = { A: 3, B: 3, C: 3, others: 31 };
    const patterns: Patterns = [
      [{ type: "card", name: "A", required: 1 }],
      [
        { type: "card", name: "B", required: 1 },
        { type: "card", name: "C", required: 1 },
      ],
    ];
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
    const patterns: Patterns = [[{ type: "card", name: "A", required: 2 }]];
    const result = calculateStarterRate(deck, patterns);
    const expected =
      combination(3, 2) * combination(37, 3) +
      combination(3, 3) * combination(37, 2);
    expect(result.successHands).toBe(expected);
  });

  // 12.5 40枚未満のデッキはダミー補完して計算
  it("12.5 40枚未満のデッキはダミーで補完される", () => {
    const deck = { A: 3, others: 36 };
    const result = calculateStarterRate(
      deck,
      [[{ type: "card", name: "A", required: 1 }]],
      40,
    );
    const expected = combination(40, 5) - combination(37, 5);
    expect(result.successHands).toBe(expected);
    expect(result.totalHands).toBe(combination(40, 5));
  });

  // 12.5 異常系
  it("12.5 合計40枚超過のデッキはエラー", () => {
    expect(() =>
      calculateStarterRate(
        { A: 3, others: 38 },
        [[{ type: "card", name: "A", required: 1 }]],
        40,
      ),
    ).toThrow();
  });

  it("12.5 負の枚数はエラー", () => {
    expect(() =>
      calculateStarterRate({ A: -1, others: 41 }, [
        [{ type: "card", name: "A", required: 1 }],
      ]),
    ).toThrow();
  });

  it("12.5 条件にデッキ外カードはエラー", () => {
    expect(() =>
      calculateStarterRate({ A: 3, others: 37 }, [
        [{ type: "card", name: "X", required: 1 }],
      ]),
    ).toThrow();
  });

  // 60枚デッキの計算
  it("60枚デッキで単純1枚初動の理論値と一致する", () => {
    const deck = { A: 3, others: 57 };
    const result = calculateStarterRate(
      deck,
      [[{ type: "card", name: "A", required: 1 }]],
      60,
    );
    const expected = combination(60, 5) - combination(57, 5);
    expect(result.successHands).toBe(expected);
    expect(result.totalHands).toBe(combination(60, 5));
  });

  describe("ラベル条件", () => {
    it("A:3+B:3 に同じラベルを付け合計1枚以上の条件", () => {
      // label条件 {初動: 1} は「A+Bの合計1枚以上」を意味する
      // 成功手 = C(40,5) - C(34,5)（A・Bを1枚も引かない手を除外）
      const deck = { A: 3, B: 3, others: 34 };
      const cardLabels: CardLabels = { A: ["初動"], B: ["初動"] };
      const result = calculateStarterRate(
        deck,
        [[{ type: "label", label: "初動", required: 1 }]],
        40,
        cardLabels,
      );
      const expected = combination(40, 5) - combination(34, 5);
      expect(result.successHands).toBe(expected);
    });

    it("ラベルにカードが0枚の場合は成功0", () => {
      const deck = { A: 3, others: 37 };
      const result = calculateStarterRate(
        deck,
        [[{ type: "label", label: "存在しない", required: 1 }]],
        40,
        {},
      );
      expect(result.successHands).toBe(0);
    });
  });
});
