import { describe, expect, it } from "vitest";
import { createDefaultStorage } from "../utils/storage";
import type { AppStorage, BattleRecord } from "../types";
import {
  reduceAddDeck,
  reduceAddRecord,
  reduceDeleteRecord,
  reduceDeleteRecords,
  reduceDeleteTag,
  reduceImportRecords,
  reduceRenameTag,
  reduceUpdateRecord,
} from "./reducer";
import type { CsvImportRow } from "../utils/csvImportHelpers";

function baseState(): AppStorage {
  return {
    ...createDefaultStorage(),
    ownDecks: [{ id: "own-1", name: "MyDeck" }],
    opponentDecks: [{ id: "opp-1", name: "Enemy" }],
    knownTags: ["手札事故"],
  };
}

function makeRecord(overrides: Partial<BattleRecord> = {}): BattleRecord {
  return {
    id: "r-existing",
    createdAt: "2026-01-01T00:00:00.000Z",
    ownDeckId: "own-1",
    opponentDeckId: "opp-1",
    result: "win",
    turnOrder: "first",
    reasonTags: [],
    memo: "",
    ...overrides,
  };
}

describe("reduceAddRecord", () => {
  it("prepends the new record", () => {
    const initial = baseState();
    const next = reduceAddRecord(initial, {
      ownDeckId: "own-1",
      opponentDeckId: "opp-1",
      result: "win",
      turnOrder: "first",
      reasonTags: [],
      memo: "",
    });
    expect(next.records).toHaveLength(1);
    expect(next.records[0].result).toBe("win");
  });

  it("auto-registers new reasonTags into knownTags", () => {
    const initial = baseState();
    const next = reduceAddRecord(initial, {
      ownDeckId: "own-1",
      opponentDeckId: "opp-1",
      result: "loss",
      turnOrder: "second",
      reasonTags: ["手札事故", "ミス"],
      memo: "",
    });
    expect(next.knownTags).toEqual(["手札事故", "ミス"]);
  });

  it("returns the same knownTags reference when no new tag appears", () => {
    const initial = baseState();
    const next = reduceAddRecord(initial, {
      ownDeckId: "own-1",
      opponentDeckId: "opp-1",
      result: "loss",
      turnOrder: "second",
      reasonTags: ["手札事故"],
      memo: "",
    });
    expect(next.knownTags).toBe(initial.knownTags);
  });
});

describe("reduceUpdateRecord / reduceDeleteRecord(s)", () => {
  it("patches a single record", () => {
    const initial: AppStorage = { ...baseState(), records: [makeRecord()] };
    const next = reduceUpdateRecord(initial, "r-existing", { memo: "edited" });
    expect(next.records[0].memo).toBe("edited");
  });

  it("removes a single record", () => {
    const initial: AppStorage = { ...baseState(), records: [makeRecord()] };
    const next = reduceDeleteRecord(initial, "r-existing");
    expect(next.records).toHaveLength(0);
  });

  it("bulk-removes records", () => {
    const initial: AppStorage = {
      ...baseState(),
      records: [
        makeRecord({ id: "a" }),
        makeRecord({ id: "b" }),
        makeRecord({ id: "c" }),
      ],
    };
    const next = reduceDeleteRecords(initial, ["a", "c"]);
    expect(next.records.map((r) => r.id)).toEqual(["b"]);
  });

  it("returns the same state when removing zero ids", () => {
    const initial: AppStorage = { ...baseState(), records: [makeRecord()] };
    const next = reduceDeleteRecords(initial, []);
    expect(next).toBe(initial);
  });
});

describe("reduceImportRecords", () => {
  it("deduplicates new decks within a single import", () => {
    const initial = baseState();
    const rows: CsvImportRow[] = [
      {
        createdAt: "2026-01-02T00:00:00.000Z",
        ownDeckName: "NewDeck",
        opponentDeckName: "NewOpp",
        result: "win",
        turnOrder: "first",
        reasonTags: [],
        memo: "",
      },
      {
        createdAt: "2026-01-03T00:00:00.000Z",
        ownDeckName: "NewDeck",
        opponentDeckName: "NewOpp",
        result: "loss",
        turnOrder: "second",
        reasonTags: [],
        memo: "",
      },
    ];

    const { state: next, importedCount } = reduceImportRecords(initial, rows);

    expect(importedCount).toBe(2);
    expect(next.ownDecks).toHaveLength(2); // existing + 1 new
    expect(next.opponentDecks).toHaveLength(2);
    expect(next.records).toHaveLength(2);
  });

  it("normalizes deck names so 'Deck' and ' Deck ' merge", () => {
    const initial = baseState();
    const rows: CsvImportRow[] = [
      {
        createdAt: "2026-01-02T00:00:00.000Z",
        ownDeckName: "Brand",
        opponentDeckName: "",
        result: "win",
        turnOrder: "first",
        reasonTags: [],
        memo: "",
      },
      {
        createdAt: "2026-01-03T00:00:00.000Z",
        ownDeckName: "  Brand  ",
        opponentDeckName: "",
        result: "loss",
        turnOrder: "second",
        reasonTags: [],
        memo: "",
      },
    ];

    const { state: next } = reduceImportRecords(initial, rows);
    expect(next.ownDecks.filter((d) => d.name === "Brand")).toHaveLength(1);
  });

  it("auto-discovers new reasonTags", () => {
    const initial = baseState();
    const rows: CsvImportRow[] = [
      {
        createdAt: "2026-01-02T00:00:00.000Z",
        ownDeckName: "MyDeck",
        opponentDeckName: "Enemy",
        result: "win",
        turnOrder: "first",
        reasonTags: ["新タグ", "もう一つ"],
        memo: "",
      },
    ];
    const { state: next } = reduceImportRecords(initial, rows);
    expect(next.knownTags).toEqual(["手札事故", "新タグ", "もう一つ"]);
  });

  it("no-ops when given an empty row list", () => {
    const initial = baseState();
    const { state: next, importedCount } = reduceImportRecords(initial, []);
    expect(importedCount).toBe(0);
    expect(next).toBe(initial);
  });
});

describe("reduceAddDeck", () => {
  it("returns the existing deck instead of creating a duplicate", () => {
    const initial = baseState();
    const { state: next, deck } = reduceAddDeck(initial, "ownDecks", "MyDeck");
    expect(deck.id).toBe("own-1");
    expect(next).toBe(initial);
  });

  it("creates a new deck when name is fresh", () => {
    const initial = baseState();
    const { state: next, deck } = reduceAddDeck(initial, "ownDecks", "Fresh");
    expect(next.ownDecks).toHaveLength(2);
    expect(next.ownDecks[1].id).toBe(deck.id);
  });
});

describe("reduceRenameTag", () => {
  it("renames the tag in knownTags and all records that reference it", () => {
    const initial: AppStorage = {
      ...baseState(),
      records: [
        makeRecord({ id: "a", reasonTags: ["手札事故", "他"] }),
        makeRecord({ id: "b", reasonTags: ["他"] }),
      ],
    };
    const next = reduceRenameTag(initial, "手札事故", "事故");
    expect(next.knownTags).toContain("事故");
    expect(next.knownTags).not.toContain("手札事故");
    expect(next.records[0].reasonTags).toEqual(["事故", "他"]);
    expect(next.records[1].reasonTags).toEqual(["他"]); // unchanged
    // Identity preserved for untouched records
    expect(next.records[1]).toBe(initial.records[1]);
  });

  it("returns the same state when source tag is unknown", () => {
    const initial = baseState();
    const next = reduceRenameTag(initial, "存在しない", "新");
    expect(next).toBe(initial);
  });
});

describe("reduceDeleteTag", () => {
  it("removes the tag from knownTags and all records", () => {
    const initial: AppStorage = {
      ...baseState(),
      records: [makeRecord({ id: "a", reasonTags: ["手札事故", "他"] })],
      knownTags: ["手札事故", "他"],
    };
    const next = reduceDeleteTag(initial, "手札事故");
    expect(next.knownTags).toEqual(["他"]);
    expect(next.records[0].reasonTags).toEqual(["他"]);
  });

  it("returns the same state when tag does not exist", () => {
    const initial = baseState();
    const next = reduceDeleteTag(initial, "ない");
    expect(next).toBe(initial);
  });
});
