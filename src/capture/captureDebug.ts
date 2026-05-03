export function isCaptureDebugSearch(search: string): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return params.get('captureDebug') === '1';
}

interface LocationLike {
  search: string;
  hash: string;
}

export function isCaptureDebugUrl(url: LocationLike): boolean {
  if (isCaptureDebugSearch(url.search)) return true;

  const queryStart = url.hash.indexOf('?');
  if (queryStart === -1) return false;

  return isCaptureDebugSearch(url.hash.slice(queryStart + 1));
}

export function getCaptureDebugEnabled(): boolean {
  const w = (globalThis as Record<string, unknown>)['window'] as { location?: LocationLike } | undefined;
  if (!w?.location) return false;
  return isCaptureDebugUrl(w.location);
}

export function createCaptureFilename(kind: 'current' | 'result-candidate', date = new Date()): string {
  const timestamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    '-',
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join('');

  return `duel-capture-${kind}-${timestamp}.png`;
}

export function canvasToDataUrl(canvas: HTMLCanvasElement): string | null {
  if (canvas.width === 0 || canvas.height === 0) return null;
  return canvas.toDataURL('image/png');
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}
