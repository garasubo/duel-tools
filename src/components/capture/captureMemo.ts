import type { CaptureMemoShot } from "../../types";

export type { CaptureMemoShot };

function generateId(now: number): string {
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return `${now}-${Math.random().toString(36).slice(2)}`;
}

export function createMemoShot(dataUrl: string, now: number): CaptureMemoShot {
  return { id: generateId(now), dataUrl, createdAt: now };
}

export function removeMemoShot(list: CaptureMemoShot[], id: string): CaptureMemoShot[] {
  return list.filter((shot) => shot.id !== id);
}
