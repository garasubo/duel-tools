import { closeSync, existsSync, openSync, readFileSync, readSync } from 'fs';
import path from 'path';
import type { ImageLike, Worker } from 'tesseract.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDpOcrWorker, detectDpFromImageLike } from './dpDetect';

const FIXTURES = path.resolve(import.meta.dirname, 'fixtures');
const FIXTURES_CSV = path.resolve(import.meta.dirname, 'fixtures.csv');

interface DpFixtureRow {
  filename: string;
  dpExpected: number | null;
}

// fixtures.csv の dp_expected 列（index 5）を読む。値が無い行（DC/DP 画面でない、
// または未記入）は skip する。'none' は null（DP 非検出が期待値）、それ以外は整数。
function loadDpFixtures(): DpFixtureRow[] {
  if (!existsSync(FIXTURES_CSV) || !existsSync(FIXTURES)) return [];
  const content = readFileSync(FIXTURES_CSV, 'utf-8');
  return content
    .split('\n')
    .slice(1)
    .filter((line) => line.trim())
    .flatMap((line) => {
      const parts = line.split(',');
      const filename = parts[0];
      const dpExpectedStr = parts[5];
      if (!dpExpectedStr) return [];
      const filepath = path.join(FIXTURES, filename);
      if (!existsSync(filepath)) return [];
      const dpExpected = dpExpectedStr === 'none' ? null : parseInt(dpExpectedStr, 10);
      return [{ filename, dpExpected }];
    });
}

function readPngDimensions(filepath: string): { width: number; height: number } {
  const buf = Buffer.alloc(24);
  const fd = openSync(filepath, 'r');
  readSync(fd, buf, 0, 24, 0);
  closeSync(fd);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('detectDpFromImageLike（プレースホルダ）', () => {
  it('現状はスタブで常に null を返す', async () => {
    // スタブは worker を使わないため、OCR 起動コストを避けてダミーを渡す。
    const dummy = null as unknown as Worker;
    await expect(
      detectDpFromImageLike(dummy, 'dummy.png' as unknown as ImageLike, 1600, 900),
    ).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// fixture 画像による統合テスト
// fixtures.csv の dp_expected 列に値がある行のみテストを生成する。
// 現状の fixture は全てレート戦由来で dp_expected は空のため 0 件。
// DC モード画像 + DP 期待値を追加すると、このブロックがケースを生成する。
// ---------------------------------------------------------------------------

const dpFixtures = loadDpFixtures();

if (dpFixtures.length > 0) {
  describe('fixture image dp detection', () => {
    let worker: Worker;

    beforeAll(async () => {
      worker = await createDpOcrWorker();
    }, 30000);

    afterAll(async () => {
      await worker.terminate();
    });

    for (const { filename, dpExpected } of dpFixtures) {
      const filepath = path.join(FIXTURES, filename);
      it(
        `${filename} → ${dpExpected ?? 'null'} と認識する`,
        async () => {
          const { width, height } = readPngDimensions(filepath);
          const result = await detectDpFromImageLike(worker, filepath, width, height);
          if (dpExpected === null) {
            expect(result).toBeNull();
          } else {
            expect(result).toBe(dpExpected);
          }
        },
        30000,
      );
    }
  });
}
