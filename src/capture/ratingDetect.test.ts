import { closeSync, existsSync, openSync, readFileSync, readSync } from 'fs';
import path from 'path';
import type { Worker } from 'tesseract.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRatingOcrWorker, detectRatingFromImageLike, parseRatingFromText } from './ratingDetect';

const FIXTURES = path.resolve(import.meta.dirname, 'fixtures');
const FIXTURES_CSV = path.resolve(import.meta.dirname, 'fixtures.csv');

interface RateFixtureRow {
  filename: string;
  rateExpected: number | null;
}

function loadRateFixtures(): RateFixtureRow[] {
  if (!existsSync(FIXTURES_CSV) || !existsSync(FIXTURES)) return [];
  const content = readFileSync(FIXTURES_CSV, 'utf-8');
  return content
    .split('\n')
    .slice(1)
    .filter((line) => line.trim())
    .flatMap((line) => {
      const parts = line.split(',');
      const filename = parts[0];
      const rateExpectedStr = parts[4];
      if (!rateExpectedStr) return [];
      const filepath = path.join(FIXTURES, filename);
      if (!existsSync(filepath)) return [];
      const rateExpected = rateExpectedStr === 'none' ? null : parseFloat(rateExpectedStr);
      return [{ filename, rateExpected }];
    });
}

function readPngDimensions(filepath: string): { width: number; height: number } {
  const buf = Buffer.alloc(24);
  const fd = openSync(filepath, 'r');
  readSync(fd, buf, 0, 24, 0);
  closeSync(fd);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

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

// ---------------------------------------------------------------------------
// fixture 画像による統合テスト
// fixtures.csv の rate_expected 列に値がある行のみテストを生成する。
// ディレクトリや画像ファイルが存在しない場合はテストを生成しない。
// ---------------------------------------------------------------------------

const rateFixtures = loadRateFixtures();

if (rateFixtures.length > 0) {
  describe('fixture image rate detection', () => {
    let worker: Worker;

    beforeAll(async () => {
      worker = await createRatingOcrWorker();
    }, 30000);

    afterAll(async () => {
      await worker.terminate();
    });

    for (const { filename, rateExpected } of rateFixtures) {
      const filepath = path.join(FIXTURES, filename);
      it(
        `${filename} → ${rateExpected ?? 'null'} と認識する`,
        async () => {
          const { width, height } = readPngDimensions(filepath);
          const result = await detectRatingFromImageLike(worker, filepath, width, height);
          if (rateExpected === null) {
            expect(result).toBeNull();
          } else {
            expect(result).toBe(rateExpected);
          }
        },
        30000,
      );
    }
  });
}
