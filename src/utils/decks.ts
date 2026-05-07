import type { Deck } from "../types";

export function normalizeDeckName(name: string): string {
  return name.trim();
}

export function findDeckByName(decks: Deck[], name: string): Deck | undefined {
  const normalized = normalizeDeckName(name);
  return decks.find((deck) => normalizeDeckName(deck.name) === normalized);
}

export function addDeckIfMissing(
  decks: Deck[],
  name: string,
  createId: () => string,
): { decks: Deck[]; deck: Deck; added: boolean } {
  const normalizedName = normalizeDeckName(name);
  const existing = findDeckByName(decks, normalizedName);
  if (existing) return { decks, deck: existing, added: false };

  const deck: Deck = { id: createId(), name: normalizedName };
  return { decks: [...decks, deck], deck, added: true };
}
