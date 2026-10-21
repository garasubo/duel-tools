import { closeSync, existsSync, openSync, readFileSync, readSync } from 'fs';
import path from 'path';
import type { Worker } from 'tesseract.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createRatingOcrWorker,
  detectRatingFromImageLike,
  detectRatingFromScreen,
  getLastRatingOcrPassCount,
  isLobbyScreenText,
  isResultScreenText,
  parseForLobbyScreen,
  parseRatingFromText,
  parseResultScreenRating,
  reconstructDelta,
  reconstructRate,
  ratingRoiHasText,
  RATING_MIN_TEXT_DENSITY,
  RATING_ROI,
} from './ratingDetect';
import { brightTextDensityInRoi, readImagePixels, type ImagePixels } from './ocrDetect';

const FIXTURES = path.resolve(import.meta.dirname, 'fixtures');
const FIXTURES_CSV = path.resolve(import.meta.dirname, 'fixtures.csv');
const SKIP_DVC_TESTS = process.env.SKIP_DVC_TESTS === 'true';

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

  it('整数のみは null（ゲーム内レートは常に小数点付き）', () => {
    expect(parseRatingFromText('1500')).toBe(null);
  });

  it('テキスト混在でも抽出できる（レート戦ロビー画面）', () => {
    expect(parseRatingFromText('RATE: 1501.43 TOP 50%')).toBe(1501.43);
  });

  it('複数候補から最後の値を返す（デュエルリザルト画面：旧レート >>> 新レート）', () => {
    expect(parseRatingFromText('1508.94 -7.51 1501.43')).toBe(1501.43);
  });

  it('複数整数候補はすべて null（小数なし）', () => {
    expect(parseRatingFromText('1500 1480')).toBe(null);
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

  it('境界値 1001 は整数なので null', () => {
    expect(parseRatingFromText('1001')).toBe(null);
  });

  it('境界値 1001.00 を小数で受け入れる', () => {
    expect(parseRatingFromText('1001.00')).toBe(1001);
  });

  it('境界値 2000 は整数なので null', () => {
    expect(parseRatingFromText('2000')).toBe(null);
  });

  it('境界値 2000.00 を小数で受け入れる', () => {
    expect(parseRatingFromText('2000.00')).toBe(2000);
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

describe('reconstructRate', () => {
  it('小数点付きはそのまま', () => {
    expect(reconstructRate('1508.94')).toBe(1508.94);
  });
  it('小数点欠落の6桁を復元する（"153965" → 1539.65）', () => {
    expect(reconstructRate('153965')).toBe(1539.65);
  });
  it('小数点欠落の6桁を復元する（"151701" → 1517.01）', () => {
    expect(reconstructRate('151701')).toBe(1517.01);
  });
  it('非数字混入を除去して復元する', () => {
    expect(reconstructRate('U1508.94')).toBe(1508.94);
  });
  it('4桁（小数部不明）は復元できず null', () => {
    expect(reconstructRate('1508')).toBe(null);
  });
});

describe('reconstructDelta', () => {
  it('小数点付きはそのまま', () => {
    expect(reconstructDelta('8.04')).toBe(8.04);
  });
  it('小数点欠落の3桁を復元する（"751" → 7.51）', () => {
    expect(reconstructDelta('751')).toBe(7.51);
  });
  it('小数点欠落の3桁を復元する（"835" → 8.35）', () => {
    expect(reconstructDelta('835')).toBe(8.35);
  });
});

describe('parseResultScreenRating（旧 ± 変化量 による検証）', () => {
  it('旧 ± 変化量 と一致する new を採用する', () => {
    expect(parseResultScreenRating('1508.94 - 751 )) 1501.43')).toBe(1501.43);
  });
  it('加算ケースも検証して採用する', () => {
    expect(parseResultScreenRating('1493.75 + 756 )) 1501.31')).toBe(1501.31);
  });
  it('旧レートの小数点欠落を復元して検証する（"153965"）', () => {
    expect(parseResultScreenRating('153965 + 8.04 ))) 1547.69')).toBe(1547.69);
  });
  it('new が 旧 ± 変化量 と矛盾する場合は null（誤読フレームを確定しない）', () => {
    // 新レートの 1 桁が誤読（1501.43 → 1601.43）。旧 - 変化量 = 1501.43 と矛盾。
    expect(parseResultScreenRating('1508.94 - 751 )) 1601.43')).toBe(null);
  });
  it('"))" の後ろに new が無い遷移フレームは null（旧レートのみ表示）', () => {
    expect(parseResultScreenRating('1524.41 - 8.12 )) Lv. 42')).toBe(null);
  });
  it('旧レート/変化量が読めない場合は ")) 以降" の値にフォールバックする', () => {
    expect(parseResultScreenRating('noise )) 1501.43')).toBe(1501.43);
  });
  it('マイナス記号が em ダッシュに誤読されても検証できる', () => {
    expect(parseResultScreenRating('1508.94 — 751 )) 1501.43')).toBe(1501.43);
  });
});

describe('parseForLobbyScreen（数字分断 + 小数点スペース化の復元）', () => {
  it('"RATE: 1 601 .76"（分断 + 小数点スペース化）を復元する', () => {
    // collapse → "1601 .76"、restore → "1601.76"（複合正規化が必要）
    expect(parseForLobbyScreen('RATE: 1 601 .76\nTOP 50 %')).toBe(1601.76);
  });
  it('クリーンな小数表記をそのまま拾う', () => {
    expect(parseForLobbyScreen('RATE: 1501.43 TOP 50%')).toBe(1501.43);
  });
  it('"RATE: 1 B51 6.29"（英字混入）をキーワード抽出で復元する', () => {
    expect(parseForLobbyScreen('RATE: 1 B51 6.29 TOP 50.')).toBe(1516.29);
  });
  it('数字が無ければ null', () => {
    expect(parseForLobbyScreen('RATE: TOP 50%')).toBe(null);
  });

  it.each([
    'RATE: 1 492.12 1 . |',
    'RATE: 1 492 .12 1 . |',
    'RATE: 1 492. 12 1 . |',
    'RATE: 1492.12 123 TOP 50%',
  ])('小数部2桁の後の数字ノイズを結合しない: %s', (text) => {
    expect(parseForLobbyScreen(text)).toBe(1492.12);
  });

  it('小数部の1桁目と2桁目の空白は結合して復元する', () => {
    expect(parseForLobbyScreen('RATE: 1 517.0 1 TOP 50%')).toBe(1517.01);
  });
});

describe('isResultScreenText', () => {
  it('Tesseractが ">>" を "))" として出力した場合にリザルト画面と判定する', () => {
    // 実際のOCR出力: "1508.94 - 751 )) 1501.43"
    expect(isResultScreenText('1508.94 - 751 )) 1501.43')).toBe(true);
  });
  it('"))" が2個以上あればリザルト画面と判定する', () => {
    expect(isResultScreenText('1524.83 + 765 )) 1532.48')).toBe(true);
  });
  it('単独の ")" はリザルト画面と判定しない', () => {
    expect(isResultScreenText('score (1500)')).toBe(false);
  });
  it('ロビー画面テキストはリザルト画面と判定しない', () => {
    expect(isResultScreenText('RATE: 1517.01 TOP 50%')).toBe(false);
  });
  it('無関係なテキストは false', () => {
    expect(isResultScreenText('VICTORY')).toBe(false);
  });
});

describe('isLobbyScreenText', () => {
  it('"RATE" キーワードでロビー画面と判定する', () => {
    expect(isLobbyScreenText('RATE: 1517.01 TOP 50%')).toBe(true);
  });
  it('"TOP" キーワードでロビー画面と判定する', () => {
    // 実際のOCR出力: "FATE 1517.77\nTOP 50 %"
    expect(isLobbyScreenText('FATE 1517.77\nTOP 50 %')).toBe(true);
  });
  it('OCR誤読 "FATE" もロビー画面と判定する', () => {
    // 実際のOCR出力例: "FATE 1517.77"
    expect(isLobbyScreenText('FATE 1517.77')).toBe(true);
  });
  it('小文字 "top" もロビー画面と判定する', () => {
    expect(isLobbyScreenText('top 50%')).toBe(true);
  });
  it('リザルト画面テキスト（"))"のみ）はロビー画面と判定しない', () => {
    expect(isLobbyScreenText('1524.83 + 765 )) 1532.48')).toBe(false);
  });
  it('無関係なテキストは false', () => {
    expect(isLobbyScreenText('VICTORY')).toBe(false);
  });
  it('デュエルスコア画面テキストは false（誤検知防止）', () => {
    // 実際のOCR出力例: "3900 x1 ... 1500 ... 1000 ..."
    expect(isLobbyScreenText('3900 1500 1000 100 200')).toBe(false);
  });
});

function mockWorker(...texts: string[]): Worker {
  const recognize = vi.fn();
  for (const text of texts) recognize.mockResolvedValueOnce({ data: { text } });
  return { setParameters: vi.fn().mockResolvedValue({}), recognize } as unknown as Worker;
}

function pixelCanvas(whitePixels = 0, top = 40): HTMLCanvasElement {
  const data = new Uint8ClampedArray(100 * 100 * 4);
  for (let i = 0; i < 100 * 100; i++) data[i * 4 + 3] = 255;
  for (let i = 0; i < whitePixels; i++) {
    const offset = ((top + Math.floor(i / 90)) * 100 + 5 + i % 90) * 4;
    data.fill(255, offset, offset + 4);
  }
  return {
    width: 100,
    height: 100,
    getContext: () => ({ getImageData: () => ({ data }) }),
  } as unknown as HTMLCanvasElement;
}

describe('レートOCRの省略と早期終了', () => {
  const detect = (worker: Worker) => detectRatingFromImageLike(worker, Buffer.alloc(0), 100, 100);

  it.each([0, 22])('明文字が%dピクセルなら両入口でOCRを省略する', async (whitePixels) => {
    const worker = mockWorker('RATE: 1516.29');
    const canvas = pixelCanvas(whitePixels);
    await expect(detectRatingFromImageLike(worker, canvas, 100, 100)).resolves.toBeNull();
    await expect(detectRatingFromScreen(worker, canvas)).resolves.toBeNull();
    expect(worker.recognize).not.toHaveBeenCalled();
    expect(worker.setParameters).not.toHaveBeenCalled();
    expect(getLastRatingOcrPassCount()).toBe(0);
  });

  it('ROI内の十分な明文字は通し、ROI外の明文字は無視する', async () => {
    const inside = await readImagePixels(pixelCanvas(23));
    const outside = await readImagePixels(pixelCanvas(90, 0));
    expect(ratingRoiHasText(inside!)).toBe(true);
    expect(ratingRoiHasText(outside!)).toBe(false);
    const worker = mockWorker('RATE: 1516.29');
    await expect(detectRatingFromScreen(worker, pixelCanvas(23))).resolves.toBe(1516.29);
    expect(getLastRatingOcrPassCount()).toBe(1);
  });

  it.each([
    '1508.94 - 751 )) 1501.43',
    'RATE: 1501.43 TOP 50%',
  ])('PSM6で確定できれば1回で終了する: %s', async (text) => {
    const worker = mockWorker(text);
    await expect(detect(worker)).resolves.toBe(1501.43);
    expect(worker.recognize).toHaveBeenCalledTimes(1);
    expect(getLastRatingOcrPassCount()).toBe(1);
  });

  it('末尾の数字ノイズを除去して1パスでロビーの値を確定する', async () => {
    const worker = mockWorker('RATE: 1 492.12 1 . |');
    await expect(detect(worker)).resolves.toBe(1492.12);
    expect(worker.recognize).toHaveBeenCalledTimes(1);
    expect(getLastRatingOcrPassCount()).toBe(1);
  });

  it('PSM11でマーカーを読めた場合もPSM6の値を優先する', async () => {
    const worker = mockWorker('1516.29', 'FATE: 1516.20');
    await expect(detect(worker)).resolves.toBe(1516.29);
    expect(getLastRatingOcrPassCount()).toBe(2);
  });

  it('PSM6で未確定ならPSM11のリザルトを採用する', async () => {
    const worker = mockWorker('noise', '1508.94 - 751 )) 1501.43');
    await expect(detect(worker)).resolves.toBe(1501.43);
    expect(getLastRatingOcrPassCount()).toBe(2);
  });

  it('ホワイトリストのフォールバック後、次の検出では設定を解除する', async () => {
    const worker = mockWorker('RATE: unreadable', 'TOP unreadable', '151629', 'RATE: 1516.29');
    await expect(detect(worker)).resolves.toBe(1516.29);
    expect(getLastRatingOcrPassCount()).toBe(3);
    expect(worker.setParameters).toHaveBeenLastCalledWith({
      tessedit_pageseg_mode: '11', tessedit_char_whitelist: '0123456789.',
    });
    await expect(detect(worker)).resolves.toBe(1516.29);
    expect(worker.setParameters).toHaveBeenLastCalledWith({
      tessedit_pageseg_mode: '6', tessedit_char_whitelist: '',
    });
    expect(getLastRatingOcrPassCount()).toBe(1);
  });

  it.each([
    '1516.29',
    '1524.41 - 8.12 )) Lv. 42',
    '1508.94 - 751 )) 1601.43',
  ])('マーカー不足や曖昧なリザルトから早期確定しない: %s', async (text) => {
    const worker = mockWorker(text, 'noise');
    await expect(detect(worker)).resolves.toBeNull();
    expect(worker.recognize).toHaveBeenCalledTimes(2);
  });

  it('両マーカーがある場合もリザルト検証を優先して次のパスを待つ', async () => {
    const worker = mockWorker(
      'RATE: 1508.94 - 751 )) 1601.43',
      '1508.94 - 751 )) 1501.43',
    );
    await expect(detect(worker)).resolves.toBe(1501.43);
    expect(getLastRatingOcrPassCount()).toBe(2);
  });

  it('画像読み取り失敗時はOCRを続行する', async () => {
    const canvas = pixelCanvas();
    canvas.getContext = () => { throw new Error('unreadable'); };
    const worker = mockWorker('RATE: 1516.29');
    await expect(detectRatingFromScreen(worker, canvas)).resolves.toBe(1516.29);
    expect(getLastRatingOcrPassCount()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// fixture 画像による統合テスト
// fixtures.csv の rate_expected 列に値がある行のみテストを生成する。
// ディレクトリや画像ファイルが存在しない場合はテストを生成しない。
// ---------------------------------------------------------------------------

const rateFixtures = loadRateFixtures();

if (rateFixtures.length > 0) {
  describe.skipIf(SKIP_DVC_TESTS)('fixture image rate detection', () => {
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
            const pixels = await readImagePixels(filepath);
            expect(pixels).not.toBeNull();
            expect(brightTextDensityInRoi(pixels as ImagePixels, RATING_ROI))
              .toBeGreaterThanOrEqual(RATING_MIN_TEXT_DENSITY);
            // 0070/0074 は PSM11 で初めてロビーマーカーが読めるため2パス必要。
            const maxPasses = filename === '0070.png' || filename === '0074.png' ? 2 : 1;
            expect(getLastRatingOcrPassCount()).toBeLessThanOrEqual(maxPasses);
          }
        },
        30000,
      );
    }
  });
}
