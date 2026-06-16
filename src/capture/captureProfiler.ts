// キャプチャ判定パイプラインの所要時間を計測する軽量プロファイラ。
//
// Phase 0: 30fps 化の前に各処理（フレーム取得 / 画像特徴分類 / OCR）のコストと
// 検出ループの実効 fps を可視化し、どこを最適化・Worker 化すべきかを判断する。
//
// 既定では無効（enabled=false）で、measure 系は計測オーバーヘッドなしで fn をそのまま
// 実行する。captureDebug が有効なキャプチャ中だけ setProfilerEnabled(true) で有効化する。

export interface ProfileStat {
  label: string;
  count: number;
  totalMs: number;
  avgMs: number;
  maxMs: number;
  lastMs: number;
}

export interface TickFps {
  label: string;
  fps: number;
}

interface MutableStat {
  count: number;
  totalMs: number;
  maxMs: number;
  lastMs: number;
}

// 実効 fps を算出する移動ウィンドウ（ms）。
const TICK_WINDOW_MS = 2000;

let enabled = false;
const stats = new Map<string, MutableStat>();
const tickTimestamps = new Map<string, number[]>();

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function setProfilerEnabled(value: boolean): void {
  enabled = value;
}

export function isProfilerEnabled(): boolean {
  return enabled;
}

export function recordSample(label: string, ms: number): void {
  if (!enabled) return;
  const cur = stats.get(label) ?? { count: 0, totalMs: 0, maxMs: 0, lastMs: 0 };
  cur.count += 1;
  cur.totalMs += ms;
  cur.maxMs = Math.max(cur.maxMs, ms);
  cur.lastMs = ms;
  stats.set(label, cur);
}

export function measure<T>(label: string, fn: () => T): T {
  if (!enabled) return fn();
  const start = now();
  try {
    return fn();
  } finally {
    recordSample(label, now() - start);
  }
}

export async function measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!enabled) return fn();
  const start = now();
  try {
    return await fn();
  } finally {
    recordSample(label, now() - start);
  }
}

// 検出ループの 1 周回を記録する。getTickFps が直近ウィンドウから実効 fps を算出する。
export function recordTick(label: string, at: number = now()): void {
  if (!enabled) return;
  const arr = tickTimestamps.get(label) ?? [];
  arr.push(at);
  const cutoff = at - TICK_WINDOW_MS;
  while (arr.length > 0 && arr[0] < cutoff) arr.shift();
  tickTimestamps.set(label, arr);
}

export function getTickFps(label: string, at: number = now()): number {
  const arr = tickTimestamps.get(label);
  if (!arr || arr.length < 2) return 0;
  const span = at - arr[0];
  if (span <= 0) return 0;
  return ((arr.length - 1) / span) * 1000;
}

export function getProfileSnapshot(): ProfileStat[] {
  return Array.from(stats.entries()).map(([label, s]) => ({
    label,
    count: s.count,
    totalMs: s.totalMs,
    avgMs: s.count > 0 ? s.totalMs / s.count : 0,
    maxMs: s.maxMs,
    lastMs: s.lastMs,
  }));
}

export function getTickFpsSnapshot(): TickFps[] {
  const at = now();
  return Array.from(tickTimestamps.keys()).map((label) => ({
    label,
    fps: getTickFps(label, at),
  }));
}

export function resetProfile(): void {
  stats.clear();
  tickTimestamps.clear();
}
