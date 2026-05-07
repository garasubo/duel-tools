import { describe, expect, it } from "vitest";
import { addDeckIfMissing, findDeckByName, normalizeDeckName } from "./decks";

const decks = [
  { id: "deck-1", name: "Blue-Eyes" },
  { id: "deck-2", name: "  White Forest  " },
];

describe("normalizeDeckName", () => {
  it("前後空白を除去する", () => {
    expect(normalizeDeckName("  天盃龍  ")).toBe("天盃龍");
  });
});

describe("findDeckByName", () => {
  it("前後空白を除去して同名デッキを見つける", () => {
    expect(findDeckByName(decks, " White Forest ")).toEqual(decks[1]);
  });

  it("大文字小文字違いは別名として扱う", () => {
    expect(findDeckByName(decks, "blue-eyes")).toBeUndefined();
  });

  it("渡されたデッキ配列の中だけを検索する", () => {
    expect(findDeckByName([{ id: "opp-1", name: "Blue-Eyes" }], "天盃龍"))
      .toBeUndefined();
  });
});

describe("addDeckIfMissing", () => {
  it("同名デッキがある場合は追加しない", () => {
    const result = addDeckIfMissing(decks, " Blue-Eyes ", () => "new-id");

    expect(result.added).toBe(false);
    expect(result.deck).toEqual(decks[0]);
    expect(result.decks).toBe(decks);
  });

  it("同名デッキがない場合はtrim済みの名前で追加する", () => {
    const result = addDeckIfMissing(decks, " 天盃龍 ", () => "deck-3");

    expect(result.added).toBe(true);
    expect(result.deck).toEqual({ id: "deck-3", name: "天盃龍" });
    expect(result.decks).toEqual([...decks, { id: "deck-3", name: "天盃龍" }]);
  });
});
