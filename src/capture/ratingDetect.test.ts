import { describe, it, expect } from 'vitest';
import { parseRatingFromText } from './ratingDetect';

describe('parseRatingFromText', () => {
  it('小数レーティングを検出する', () => {
    expect(parseRatingFromText('1501.43')).toBe(1501.43);
  });

  it('整数レーティングを検出する', () => {
    expect(parseRatingFromText('1500')).toBe(1500);
  });

  it('テキスト混在でも抽出できる（レート戦ロビー画面）', () => {
    expect(parseRatingFromText('RATE: 1501.43 TOP 50%')).toBe(1501.43);
  });

  it('複数候補から最後の値を返す（デュエルリザルト画面：旧レート >>> 新レート）', () => {
    expect(parseRatingFromText('1508.94 -7.51 1501.43')).toBe(1501.43);
  });

  it('複数整数候補から最後の値を返す', () => {
    expect(parseRatingFromText('1500 1480')).toBe(1480);
  });

  it('範囲外は null: 999', () => {
    expect(parseRatingFromText('999')).toBe(null);
  });

  it('範囲外は null: 2001', () => {
    expect(parseRatingFromText('2001')).toBe(null);
  });

  it('範囲外は null: 999.99', () => {
    expect(parseRatingFromText('999.99')).toBe(null);
  });

  it('境界値 1000 は除外する（開始レート1500から多数負けないと到達しないため誤検知とみなす）', () => {
    expect(parseRatingFromText('1000')).toBe(null);
  });

  it('境界値 1001 を受け入れる', () => {
    expect(parseRatingFromText('1001')).toBe(1001);
  });

  it('境界値 2000 を受け入れる', () => {
    expect(parseRatingFromText('2000')).toBe(2000);
  });

  it('5桁以上の数字から部分一致しない', () => {
    expect(parseRatingFromText('10000')).toBe(null);
  });

  it('該当なしで null', () => {
    expect(parseRatingFromText('VICTORY')).toBe(null);
  });

  it('空文字で null', () => {
    expect(parseRatingFromText('')).toBe(null);
  });

  it('3桁以下の数字は無視する', () => {
    expect(parseRatingFromText('999 500 100')).toBe(null);
  });
});
