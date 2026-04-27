import { closeSync, existsSync, openSync, readdirSync, readSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { detectFromImageLike, parseDetectionResult, roiToRectangle } from './ocrDetect';
import { DEFAULT_RESULT_ROI } from './types';

const FIXTURES = path.resolve(import.meta.dirname, 'fixtures');

// ファイル名のプレフィックスで期待結果を分類する。
// 命名規則:
//   result_win_NNN.png  → 勝ち画面
//   result_lose_NNN.png → 負け画面
//   no_result_NNN.png   → 結果なし画面（null を期待）
function classifyFixture(filename: string): 'win' | 'loss' | null | undefined {
  if (filename.startsWith('result_win_')) return 'win';
  if (filename.startsWith('result_lose_')) return 'loss';
  if (filename.startsWith('no_result_')) return null;
  return undefined; // 命名規則外は無視
}

// PNG ファイルヘッダー（先頭 24 バイト）から幅・高さを読む。
// PNG IHDR チャンク: bytes 16-19 = width (BE uint32), 20-23 = height (BE uint32)
function readPngDimensions(filepath: string): { width: number; height: number } {
  const buf = Buffer.alloc(24);
  const fd = openSync(filepath, 'r');
  readSync(fd, buf, 0, 24, 0);
  closeSync(fd);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// ---------------------------------------------------------------------------
// parseDetectionResult
// ---------------------------------------------------------------------------

describe('parseDetectionResult', () => {
  it('VICTORY を含むテキストは win を返す', () => {
    expect(parseDetectionResult('VICTORY', 90)).toEqual({ result: 'win', confidence: 90 });
    expect(parseDetectionResult('  VICTORY  ', 80)).toEqual({ result: 'win', confidence: 80 });
  });

  it('小文字・混在の victory も win を返す', () => {
    expect(parseDetectionResult('victory', 75)).toEqual({ result: 'win', confidence: 75 });
    expect(parseDetectionResult('Victory!', 60)).toEqual({ result: 'win', confidence: 60 });
  });

  it('LOSE を含むテキストは loss を返す', () => {
    expect(parseDetectionResult('LOSE', 85)).toEqual({ result: 'loss', confidence: 85 });
    expect(parseDetectionResult('o LOSE /', 60)).toEqual({ result: 'loss', confidence: 60 });
  });

  it('LOSER のように LOSE を部分文字列として含む場合も loss を返す（仕様）', () => {
    expect(parseDetectionResult('LOSER', 60)).toEqual({ result: 'loss', confidence: 60 });
  });

  it('VICTORY と LOSE を両方含む場合は VICTORY 優先で win を返す', () => {
    expect(parseDetectionResult('VICTORY LOSE', 70)).toEqual({ result: 'win', confidence: 70 });
  });

  it('VICTORY と LOSE を含まないテキストは null を返す', () => {
    expect(parseDetectionResult('DRAW', 70)).toBeNull();
    expect(parseDetectionResult('', 0)).toBeNull();
    expect(parseDetectionResult('12345', 50)).toBeNull();
    expect(parseDetectionResult('!@#$%', 50)).toBeNull();
  });

  it('信頼度が閾値未満の場合は勝敗候補にしない', () => {
    expect(parseDetectionResult('VICTORY', 59)).toBeNull();
    expect(parseDetectionResult('VICTORY', 60)).toEqual({ result: 'win', confidence: 60 });
    expect(parseDetectionResult('LOSE', 59)).toBeNull();
    expect(parseDetectionResult('LOSE', 60)).toEqual({ result: 'loss', confidence: 60 });
  });
});

// ---------------------------------------------------------------------------
// roiToRectangle
// ---------------------------------------------------------------------------

describe('roiToRectangle', () => {
  it('1600×900 で正規化 ROI をピクセル座標に変換する', () => {
    const rect = roiToRectangle(DEFAULT_RESULT_ROI, 1600, 900);
    expect(rect.left).toBe(200);   // 0.125 * 1600
    expect(rect.top).toBe(270);    // 0.30  * 900
    expect(rect.width).toBe(1200); // 0.75  * 1600
    expect(rect.height).toBe(288); // 0.32  * 900
  });

  it('1920×1080（Full HD）で変換する', () => {
    const rect = roiToRectangle(DEFAULT_RESULT_ROI, 1920, 1080);
    expect(rect.left).toBe(240);   // 0.125 * 1920
    expect(rect.top).toBe(324);    // 0.30  * 1080
    expect(rect.width).toBe(1440); // 0.75  * 1920
    expect(rect.height).toBe(345); // floor(0.32 * 1080) = floor(345.6)
  });

  it('2560×1440（QHD）で変換する', () => {
    const rect = roiToRectangle(DEFAULT_RESULT_ROI, 2560, 1440);
    expect(rect.left).toBe(320);   // 0.125 * 2560
    expect(rect.top).toBe(432);    // 0.30  * 1440
    expect(rect.width).toBe(1920); // 0.75  * 2560
    expect(rect.height).toBe(460); // floor(0.32 * 1440) = floor(460.8)
  });

  it('3840×2160（4K）で変換する', () => {
    const rect = roiToRectangle(DEFAULT_RESULT_ROI, 3840, 2160);
    expect(rect.left).toBe(480);   // 0.125 * 3840
    expect(rect.top).toBe(648);    // 0.30  * 2160
    expect(rect.width).toBe(2880); // 0.75  * 3840
    expect(rect.height).toBe(691); // floor(0.32 * 2160) = floor(691.2)
  });

  it('端数が出る解像度でも Math.floor で切り捨てられる', () => {
    const rect = roiToRectangle(DEFAULT_RESULT_ROI, 1601, 901);
    expect(rect.left).toBe(200); // floor(0.125 * 1601) = floor(200.125)
    expect(rect.top).toBe(270);  // floor(0.30  * 901)  = floor(270.3)
  });
});

// ---------------------------------------------------------------------------
// fixture 画像による統合テスト
// fixtures/ ディレクトリの PNG を命名規則で自動分類して実行する。
// ディレクトリが存在しない、またはファイルがなければテストは生成されない。
// ---------------------------------------------------------------------------

// fixtures/ が存在し命名規則に合う PNG がある場合のみ describe ブロックを生成する。
// ディレクトリがない・ファイルがない場合はブロック自体を作らずエラーを回避する。
const fixtureFiles = existsSync(FIXTURES)
  ? readdirSync(FIXTURES)
      .filter((f) => f.endsWith('.png') && classifyFixture(f) !== undefined)
  : [];

if (fixtureFiles.length > 0) {
  describe('fixture image classification', () => {
    for (const file of fixtureFiles) {
      const expected = classifyFixture(file)!;
      const filepath = path.join(FIXTURES, file);
      it(
        `${file} → ${expected ?? 'null'} と認識する`,
        async () => {
          const { width, height } = readPngDimensions(filepath);
          const result = await detectFromImageLike(filepath, width, height);
          if (expected === null) {
            expect(result).toBeNull();
          } else {
            expect(result?.result).toBe(expected);
          }
        },
        30000,
      );
    }
  });
}
