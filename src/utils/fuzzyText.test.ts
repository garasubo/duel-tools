import { describe, expect, it } from 'vitest';
import { levenshtein, minWordDistance, normalizeOcrLatinChars } from './fuzzyText';

describe('normalizeOcrLatinChars', () => {
  it('数字・記号を対応するラテン文字に置換する', () => {
    expect(normalizeOcrLatinChars('L0SE')).toBe('LOSE');
    expect(normalizeOcrLatinChars('LO5E')).toBe('LOSE');
    expect(normalizeOcrLatinChars('L05E')).toBe('LOSE');
    expect(normalizeOcrLatinChars('V1CT0RY')).toBe('VICTORY');
    expect(normalizeOcrLatinChars('VICT0RY')).toBe('VICTORY');
  });

  it('大文字に変換する', () => {
    expect(normalizeOcrLatinChars('lose')).toBe('LOSE');
    expect(normalizeOcrLatinChars('victory')).toBe('VICTORY');
  });

  it('パイプ・ドルを対応文字に置換する', () => {
    expect(normalizeOcrLatinChars('|OSE')).toBe('IOSE');
    expect(normalizeOcrLatinChars('LO$E')).toBe('LOSE');
  });

  it('変換不要な文字はそのまま残す', () => {
    expect(normalizeOcrLatinChars('ABCDE')).toBe('ABCDE');
  });
});

describe('levenshtein', () => {
  it('同一文字列は 0', () => {
    expect(levenshtein('LOSE', 'LOSE')).toBe(0);
    expect(levenshtein('', '')).toBe(0);
  });

  it('1 文字の違い', () => {
    expect(levenshtein('LOCE', 'LOSE')).toBe(1); // 置換
    expect(levenshtein('LOE', 'LOSE')).toBe(1);  // 挿入
    expect(levenshtein('LOOSE', 'LOSE')).toBe(1); // 削除
  });

  it('VICTORY との距離', () => {
    expect(levenshtein('VICTOEY', 'VICTORY')).toBe(1);
    expect(levenshtein('VICTARY', 'VICTORY')).toBe(1);
    expect(levenshtein('DRAW', 'VICTORY')).toBeGreaterThan(3);
  });

  it('空文字との距離は文字列長', () => {
    expect(levenshtein('', 'LOSE')).toBe(4);
    expect(levenshtein('LOSE', '')).toBe(4);
  });
});

describe('minWordDistance', () => {
  it('ターゲットを含む単語がある場合は 0', () => {
    expect(minWordDistance('LOSE', 'LOSE')).toBe(0);
    expect(minWordDistance('o LOSE /', 'LOSE')).toBe(0);
    expect(minWordDistance('VICTORY!', 'VICTORY')).toBe(0);
  });

  it('1 文字違いの単語が含まれる場合は 1', () => {
    expect(minWordDistance('LOCE', 'LOSE')).toBe(1);
    expect(minWordDistance('VICTOEY RESULT', 'VICTORY')).toBe(1);
  });

  it('テキストが空または英数字トークンなし → Infinity', () => {
    expect(minWordDistance('', 'LOSE')).toBe(Infinity);
    expect(minWordDistance('。！？', 'LOSE')).toBe(Infinity);
  });

  it('全く異なる単語は距離が大きい', () => {
    expect(minWordDistance('DRAW', 'LOSE')).toBeGreaterThan(1);
    expect(minWordDistance('HELLO WORLD', 'VICTORY')).toBeGreaterThan(1);
  });
});
