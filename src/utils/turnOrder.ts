import type { TurnOrder } from "../types";

export const turnOrderLabel: Record<TurnOrder, string> = {
  first: "先攻",
  second: "後攻",
  third: "ゆずられ先攻",
};

export const turnOrderFromLabel: Record<string, TurnOrder> = {
  先攻: "first",
  後攻: "second",
  ゆずられ先攻: "third",
};
