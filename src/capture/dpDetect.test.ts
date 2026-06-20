import { closeSync, existsSync, openSync, readFileSync, readSync } from 'fs';
import path from 'path';
import type { Worker } from 'tesseract.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  collapseDigitSpaces,
  createDpOcrWorker,
  detectDpFromImageLike,
  dpAfterArrow,
  DP_MIN_TEXT_DENSITY,
  DP_ROI,
  dpRoiHasText,
  getLastDpOcrPassCount,
  isDpResultScreenText,
  isDpScreenText,
  parseDpFromText,
  parseDpLobbyScreen,
  parseDpResultScreen,
  validatedTransition,
} from './dpDetect';
import { brightTextDensityInRoi, type ImagePixels } from './ocrDetect';

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

// ---------------------------------------------------------------------------
// 推定ロジック（純粋関数）の単体テスト。Tesseract 不要で即時に走る。
// Tesseract は DCモードの矢印 "▶" を "))"（や ">>"）として出力する。DP は整数。
// ---------------------------------------------------------------------------

describe('collapseDigitSpaces', () => {
  it('数字間のスペースを連結する（"1 859" → "1859"）', () => {
    expect(collapseDigitSpaces('DP )) 1 859')).toBe('DP )) 1859');
  });
  it('数字以外のスペースはそのまま', () => {
    expect(collapseDigitSpaces('DP )) 1859')).toBe('DP )) 1859');
  });
  it('千区切りでない隣接単一数字ノイズは連結しない（"5735 0" はそのまま）', () => {
    expect(collapseDigitSpaces('= 5735 0')).toBe('= 5735 0');
  });
  it('3桁グループでない分割は連結しない（"173 50" はそのまま）', () => {
    expect(collapseDigitSpaces('173 50')).toBe('173 50');
  });
  it('複数の千区切りグループも連結する（"1 234 567" → "1234567"）', () => {
    expect(collapseDigitSpaces('1 234 567')).toBe('1234567');
  });
});

describe('dpAfterArrow（矢印と数字は同一行のみ）', () => {
  it('同一行で矢印直後の数字を採用する', () => {
    expect(dpAfterArrow(') 200')).toBe(200);
    expect(dpAfterArrow('mB) 2670')).toBe(2670);
  });
  it('改行を跨いだブラケット→数値は採用しない（スコア内訳テーブル 0111 系）', () => {
    expect(dpAfterArrow(') \n 200')).toBe(null);
    expect(dpAfterArrow('7)\n500')).toBe(null);
    expect(dpAfterArrow('300054\n7)\n500\n100\n)\n200\n200\n7\n42')).toBe(null);
  });
});

describe('parseDpFromText', () => {
  it('矢印以降の整数を新DPとして抽出する', () => {
    expect(parseDpFromText('DP )) 1859')).toBe(1859);
  });
  it('複数矢印では最後の矢印以降を採用する（旧 → 新）', () => {
    expect(parseDpFromText(')) 849 +1010 )) 1859')).toBe(1859);
  });
  it('スペース分断された数字を連結して抽出する', () => {
    expect(parseDpFromText('DP )) 1 859')).toBe(1859);
  });
  it('矢印が無くても妥当整数が1つなら採用する', () => {
    expect(parseDpFromText('1859')).toBe(1859);
  });
  it('矢印が無く妥当整数が複数なら曖昧として null', () => {
    expect(parseDpFromText('2026 1500')).toBe(null);
  });
  it('2桁以下のノイズは無視する', () => {
    expect(parseDpFromText('勝利数 2')).toBe(null);
  });
  it('該当なしで null', () => {
    expect(parseDpFromText('VICTORY')).toBe(null);
  });
});

describe('parseDpResultScreen（旧 ± 変化量 による検証）', () => {
  it('旧 + 変化量 と一致する新DPを採用する（0098 系）', () => {
    expect(parseDpResultScreen('DP )) 849 +1010 )) 1859')).toBe(1859);
  });
  it('減算ケースも検証して採用する', () => {
    expect(parseDpResultScreen('DP )) 2000 -141 )) 1859')).toBe(1859);
  });
  it('新DPが 旧 ± 変化量 と矛盾する場合は null（誤読フレームを確定しない）', () => {
    expect(parseDpResultScreen('DP )) 849 +1000 )) 1859')).toBe(null);
  });
  it('旧/変化量が読めない場合は最後の矢印以降の整数にフォールバックする', () => {
    expect(parseDpResultScreen('noise )) 1859')).toBe(1859);
  });
  it('マイナス記号が em ダッシュに誤読されても検証できる', () => {
    expect(parseDpResultScreen('DP )) 2000 — 141 )) 1859')).toBe(1859);
  });
});

describe('validatedTransition（矢印非依存の 旧±変化量==新 検証）', () => {
  it('二重矢印が ")»" に化けても新DPを取れる（0108 系）', () => {
    expect(validatedTransition('11805+1000)» 12805')).toBe(12805);
  });
  it('正常な二重矢印リザルトも検出する', () => {
    expect(validatedTransition('DP )) 849 +1010 )) 1859')).toBe(1859);
  });
  it('減算ケースも検証して採用する', () => {
    expect(validatedTransition('2000 -141 )) 1859')).toBe(1859);
  });
  it('変化量が無い単独DPは null（遷移ではない）', () => {
    expect(validatedTransition('11805')).toBe(null);
  });
  it('算術が一致しない場合は null（誤読フレームを確定しない）', () => {
    expect(validatedTransition('849 +1000 )) 1859')).toBe(null);
  });
});

describe('parseDpLobbyScreen（現在DPのみ表示）', () => {
  it('"DP ▶ 値" から DP を抽出する（0099 系）', () => {
    expect(parseDpLobbyScreen('DP )) 1859')).toBe(1859);
  });
  it('スペース分断された数字を連結して抽出する', () => {
    expect(parseDpLobbyScreen('DP )) 1 859')).toBe(1859);
  });
  it('矢印が読めなくても "DP" キーワード以降から抽出する', () => {
    expect(parseDpLobbyScreen('DP 1859')).toBe(1859);
  });
  it('数字が無ければ null', () => {
    expect(parseDpLobbyScreen('DP )) ---')).toBe(null);
  });
});

describe('isDpResultScreenText', () => {
  it('矢印が2群以上ならリザルト画面と判定する', () => {
    expect(isDpResultScreenText('DP )) 849 +1010 )) 1859')).toBe(true);
  });
  it('矢印1群（ロビー画面）はリザルト画面と判定しない', () => {
    expect(isDpResultScreenText('DP )) 1859')).toBe(false);
  });
  it('矢印が無ければ false', () => {
    expect(isDpResultScreenText('DP 1859')).toBe(false);
  });
});

describe('isDpScreenText', () => {
  it('矢印でDP画面と判定する', () => {
    expect(isDpScreenText('DP )) 1859')).toBe(true);
  });
  it('"DP" キーワードでDP画面と判定する', () => {
    expect(isDpScreenText('DP 1859')).toBe(true);
  });
  it('無関係なテキストは false', () => {
    expect(isDpScreenText('VICTORY')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 画像特徴ゲート（OCR 非依存）の単体テスト。
// DP_ROI 内の明テキスト密度で「OCR を走らせる価値があるか」を判定する。
// ---------------------------------------------------------------------------

// 全面黒（不透明）のピクセル。white で指定矩形を白く塗る。
function makePixels(
  width: number,
  height: number,
  white?: { x0: number; y0: number; x1: number; y1: number },
): ImagePixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data[i * 4 + 3] = 255; // alpha 不透明
  if (white) {
    for (let y = white.y0; y < white.y1; y++) {
      for (let x = white.x0; x < white.x1; x++) {
        const o = (y * width + x) * 4;
        data[o] = 255;
        data[o + 1] = 255;
        data[o + 2] = 255;
        data[o + 3] = 255;
      }
    }
  }
  return { width, height, data };
}

describe('dpRoiHasText / brightTextDensityInRoi（画像特徴ゲート）', () => {
  // DP_ROI は x0.05,y0.4,w0.9,h0.5 → 100x100 では rect 5,40,90,50（面積 4500）。
  it('明テキストが無い（全面黒）フレームは密度0でゲートが false', () => {
    const pixels = makePixels(100, 100);
    expect(brightTextDensityInRoi(pixels, DP_ROI)).toBe(0);
    expect(dpRoiHasText(pixels)).toBe(false);
  });

  it('DP_ROI 内に十分な明テキストがあれば true（OCR を走らせる）', () => {
    // 20x20 の白ブロック（DP_ROI 内）= 400px / 4500 ≈ 0.089 > 閾値
    const pixels = makePixels(100, 100, { x0: 20, y0: 50, x1: 40, y1: 70 });
    expect(brightTextDensityInRoi(pixels, DP_ROI)).toBeGreaterThan(DP_MIN_TEXT_DENSITY);
    expect(dpRoiHasText(pixels)).toBe(true);
  });

  it('明ピクセルが閾値未満のわずかなノイズはゲートで false（OCR スキップ）', () => {
    // 3x3 の白（DP_ROI 内）= 9px / 4500 ≈ 0.002 < 閾値（fixture 0112 相当）
    const pixels = makePixels(100, 100, { x0: 20, y0: 50, x1: 23, y1: 53 });
    expect(brightTextDensityInRoi(pixels, DP_ROI)).toBeLessThan(DP_MIN_TEXT_DENSITY);
    expect(dpRoiHasText(pixels)).toBe(false);
  });

  it('DP_ROI 外（画面上部）の明テキストは密度に寄与しない', () => {
    // y=0..20 は DP_ROI(top=40) より上 → ROI 密度 0
    const pixels = makePixels(100, 100, { x0: 20, y0: 0, x1: 60, y1: 20 });
    expect(brightTextDensityInRoi(pixels, DP_ROI)).toBe(0);
    expect(dpRoiHasText(pixels)).toBe(false);
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
            // 高速化の要: 値ありフレームは PSM11 先頭ラダーで 1 パスで確定する
            // （旧実装の QUALIFIERS 系 2 パス・最大3パスからの削減をロックする）。
            expect(getLastDpOcrPassCount()).toBeLessThanOrEqual(1);
          }
        },
        30000,
      );
    }
  });
}
