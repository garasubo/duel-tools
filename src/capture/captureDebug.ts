export function isCaptureDebugSearch(search: string): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return params.get('captureDebug') === '1';
}

export function isCaptureDebugUrl(url: Pick<Location, 'search' | 'hash'>): boolean {
  if (isCaptureDebugSearch(url.search)) return true;

  const queryStart = url.hash.indexOf('?');
  if (queryStart === -1) return false;

  return isCaptureDebugSearch(url.hash.slice(queryStart + 1));
}

export function getCaptureDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return isCaptureDebugUrl(window.location);
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
