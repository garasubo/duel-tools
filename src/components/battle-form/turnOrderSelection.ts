import type { TurnOrder } from "../../types";

export function getNextTurnOrderSelection(
  current: TurnOrder | null,
  selected: TurnOrder,
): TurnOrder | null {
  return current === selected ? null : selected;
}
