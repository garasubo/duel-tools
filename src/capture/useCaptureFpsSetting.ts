import { useCallback, useState } from 'react';

export const CAPTURE_FPS_STORAGE_KEY = 'duel-tools:capture-fps';

export interface CaptureFpsOption {
  value: number;
  label: string;
}

// 結果判定ループのサンプリング頻度プリセット。30fps が既定（取りこぼし最小）。
// 低スペックマシンでは頻度を下げて CPU 負荷を軽減できる。
export const CAPTURE_FPS_OPTIONS: CaptureFpsOption[] = [
  { value: 30, label: '30 fps（標準）' },
  { value: 20, label: '20 fps' },
  { value: 15, label: '15 fps' },
  { value: 10, label: '10 fps（軽量）' },
];

export const DEFAULT_CAPTURE_FPS = 30;

const ALLOWED_FPS = CAPTURE_FPS_OPTIONS.map((option) => option.value);

type CaptureFpsStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readCaptureFps(storage: CaptureFpsStorage | undefined = getStorage()): number {
  const raw = storage?.getItem(CAPTURE_FPS_STORAGE_KEY);
  const parsed = raw === null || raw === undefined ? NaN : Number.parseInt(raw, 10);
  return ALLOWED_FPS.includes(parsed) ? parsed : DEFAULT_CAPTURE_FPS;
}

export function writeCaptureFps(
  fps: number,
  storage: CaptureFpsStorage | undefined = getStorage(),
): void {
  storage?.setItem(CAPTURE_FPS_STORAGE_KEY, String(fps));
}

function getStorage(): CaptureFpsStorage | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage;
}

export function useCaptureFpsSetting() {
  const [captureFps, setCaptureFpsState] = useState(readCaptureFps);

  const setCaptureFps = useCallback((fps: number) => {
    setCaptureFpsState(fps);
    writeCaptureFps(fps);
  }, []);

  return { captureFps, setCaptureFps };
}
