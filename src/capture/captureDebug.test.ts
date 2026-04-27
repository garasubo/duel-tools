import { describe, expect, it } from 'vitest';
import { createCaptureFilename, isCaptureDebugSearch, isCaptureDebugUrl } from './captureDebug';

describe('captureDebug', () => {
  it('captureDebug=1 のときだけ検索文字列を有効扱いにする', () => {
    expect(isCaptureDebugSearch('?captureDebug=1')).toBe(true);
    expect(isCaptureDebugSearch('captureDebug=1')).toBe(true);
    expect(isCaptureDebugSearch('?captureDebug=0')).toBe(false);
    expect(isCaptureDebugSearch('?other=1')).toBe(false);
  });

  it('通常クエリと hash 内クエリの両方を読む', () => {
    expect(isCaptureDebugUrl({ search: '?captureDebug=1', hash: '#/record' })).toBe(true);
    expect(isCaptureDebugUrl({ search: '', hash: '#/record?captureDebug=1' })).toBe(true);
    expect(isCaptureDebugUrl({ search: '', hash: '#/record' })).toBe(false);
  });

  it('保存ファイル名を安定した形式で作る', () => {
    const date = new Date(2026, 3, 5, 6, 7, 8);

    expect(createCaptureFilename('current', date)).toBe('duel-capture-current-20260405-060708.png');
    expect(createCaptureFilename('result-candidate', date)).toBe(
      'duel-capture-result-candidate-20260405-060708.png',
    );
  });
});
