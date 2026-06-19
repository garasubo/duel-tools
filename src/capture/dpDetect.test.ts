import { closeSync, existsSync, openSync, readFileSync, readSync } from 'fs';
import path from 'path';
import type { Worker } from 'tesseract.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  collapseDigitSpaces,
  createDpOcrWorker,
  detectDpFromImageLike,
  isDpResultScreenText,
  isDpScreenText,
  parseDpFromText,
  parseDpLobbyScreen,
  parseDpResultScreen,
} from './dpDetect';

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
