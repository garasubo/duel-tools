import { closeSync, existsSync, openSync, readFileSync, readSync } from 'fs';
import path from 'path';
import type { Worker } from 'tesseract.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseCoinTossText, parseInDuelTurnOrder, detectCoinTossScreen, createJpnOcrWorker } from './coinTossDetect';
import { updateCoinTossState, INITIAL_COIN_TOSS_STATE } from './coinTossState';

function readPngDimensions(filepath: string): { width: number; height: number } {
  const buf = Buffer.alloc(24);
  const fd = openSync(filepath, 'r');
  readSync(fd, buf, 0, 24, 0);
  closeSync(fd);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// ---------------------------------------------------------------------------
// parseCoinTossText
// ---------------------------------------------------------------------------

describe('parseCoinTossText', () => {
  it('「選択してください」を含む → user-selecting', () => {
    expect(parseCoinTossText('先攻・後攻を選択してください')).toBe('user-selecting');
    expect(parseCoinTossText('  選択してください  ')).toBe('user-selecting');
  });

  it('「対戦相手」+「選択」を含む → opponent-selecting', () => {
    expect(parseCoinTossText('対戦相手が先攻・後攻を選択しています')).toBe('opponent-selecting');
    expect(parseCoinTossText('対戦相手が選択中')).toBe('opponent-selecting');
  });

  it('「先攻です」を含む → you-are-first', () => {
    expect(parseCoinTossText('あなたが先攻です。')).toBe('you-are-first');
    expect(parseCoinTossText('先攻です')).toBe('you-are-first');
  });

  it('OCRがスペースを挿入した場合もパースできる（先攻）', () => {
    // Tesseract.js が「あな だ た が 先攻 で 引 0」のように認識した場合
    expect(parseCoinTossText('あな だ た が 先攻 で 引 0')).toBe('you-are-first');
  });

  it('「後攻です」を含む → you-are-second', () => {
    expect(parseCoinTossText('あなたが後攻です。')).toBe('you-are-second');
    expect(parseCoinTossText('後攻です')).toBe('you-are-second');
  });

  it('OCRがスペースを挿入した場合もパースできる（後攻）', () => {
    expect(parseCoinTossText('あな た が 後 攻 で')).toBe('you-are-second');
  });

  it('OCRがスペースを挿入した場合もパースできる（選択）', () => {
    expect(parseCoinTossText('先攻 ・ 後 攻 を 選択 し て くだ さい')).toBe('user-selecting');
    expect(parseCoinTossText('対戦 相手 が 先攻 ・ 後 攻 を 選択 し て')).toBe('opponent-selecting');
  });

  it('マッチしないテキスト → null', () => {
    expect(parseCoinTossText('')).toBeNull();
    expect(parseCoinTossText('コイントス')).toBeNull();
    expect(parseCoinTossText('VICTORY')).toBeNull();
    expect(parseCoinTossText('先攻・後攻')).toBeNull(); // 「です」や「してください」がない
  });

  it('「選択してください」が「選択しています」より優先される', () => {
    expect(parseCoinTossText('先攻・後攻を選択してください')).toBe('user-selecting');
  });

  it('「対戦相手」だけでは opponent-selecting にならない', () => {
    // 「選択」が一緒にないとマッチしない
    expect(parseCoinTossText('対戦相手')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseInDuelTurnOrder
// ---------------------------------------------------------------------------

describe('parseInDuelTurnOrder', () => {
  it('「MAIN」+「TURN 1」→ first', () => {
    expect(parseInDuelTurnOrder('Turn 1\nMain 1')).toBe('first');
    expect(parseInDuelTurnOrder('MAIN PHASE 1\nTURN 1')).toBe('first');
  });

  it('「MAIN」+「TURN 2」→ second', () => {
    expect(parseInDuelTurnOrder('Turn 2\nMain 1')).toBe('second');
  });

  it('「MAIN」がなければ null', () => {
    expect(parseInDuelTurnOrder('Turn 1')).toBeNull();
    expect(parseInDuelTurnOrder('')).toBeNull();
  });

  it('「TURN」数字がなければ null', () => {
    expect(parseInDuelTurnOrder('MAIN PHASE 1')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// updateCoinTossState
// ---------------------------------------------------------------------------

describe('updateCoinTossState', () => {
  it('null screen → 状態変化なし', () => {
    expect(updateCoinTossState(INITIAL_COIN_TOSS_STATE, null)).toEqual(INITIAL_COIN_TOSS_STATE);
  });

  it('user-selecting → result=first', () => {
    const s = updateCoinTossState(INITIAL_COIN_TOSS_STATE, 'user-selecting');
    expect(s.result).toBe('first');
  });

  it('opponent-selecting → opponentSelectingDetected=true', () => {
    const s = updateCoinTossState(INITIAL_COIN_TOSS_STATE, 'opponent-selecting');
    expect(s.opponentSelectingDetected).toBe(true);
    expect(s.result).toBeNull();
  });

  it('opponent-selecting → you-are-first → result=third（ゆずられ先攻）', () => {
    let s = updateCoinTossState(INITIAL_COIN_TOSS_STATE, 'opponent-selecting');
    s = updateCoinTossState(s, 'you-are-first');
    expect(s.result).toBe('third');
  });

  it('opponent-selecting → you-are-second → result=second', () => {
    let s = updateCoinTossState(INITIAL_COIN_TOSS_STATE, 'opponent-selecting');
    s = updateCoinTossState(s, 'you-are-second');
    expect(s.result).toBe('second');
  });

  it('you-are-first のみ（opponent-selecting なし）→ result=first', () => {
    const s = updateCoinTossState(INITIAL_COIN_TOSS_STATE, 'you-are-first');
    expect(s.result).toBe('first');
  });

  it('you-are-second のみ → result=second', () => {
    const s = updateCoinTossState(INITIAL_COIN_TOSS_STATE, 'you-are-second');
    expect(s.result).toBe('second');
  });

  it('result が確定後は変化しない', () => {
    let s = updateCoinTossState(INITIAL_COIN_TOSS_STATE, 'user-selecting');
    s = updateCoinTossState(s, 'opponent-selecting');
    expect(s.result).toBe('first'); // 確定後も変わらない
  });
});

// ---------------------------------------------------------------------------
// fixture 画像による統合テスト
// ---------------------------------------------------------------------------

const FIXTURES = path.resolve(import.meta.dirname, 'fixtures');
const FIXTURES_CSV = path.resolve(import.meta.dirname, 'fixtures.csv');

interface CoinFixtureRow {
  filename: string;
  coinExpected: ReturnType<typeof parseCoinTossText>;
}

function loadCoinFixtures(): CoinFixtureRow[] {
  if (!existsSync(FIXTURES_CSV) || !existsSync(FIXTURES)) return [];
  const content = readFileSync(FIXTURES_CSV, 'utf-8');
  return content
    .split('\n')
    .slice(1)
    .filter((line) => line.trim())
    .flatMap((line) => {
      const [filename, coinExpectedStr] = line.split(',');
      if (!coinExpectedStr) return [];
      const filepath = path.join(FIXTURES, filename);
      if (!existsSync(filepath)) return [];
      const coinExpected =
        coinExpectedStr === 'none'
          ? null
          : (coinExpectedStr as Exclude<ReturnType<typeof parseCoinTossText>, null>);
      return [{ filename, coinExpected }];
    });
}

const coinFixtures = loadCoinFixtures();

if (coinFixtures.length > 0) {
  describe('fixture image classification', () => {
    let worker: Worker;

    beforeAll(async () => {
      worker = await createJpnOcrWorker();
    }, 30000);

    afterAll(async () => {
      await worker.terminate();
    });

    for (const { filename, coinExpected } of coinFixtures) {
      const filepath = path.join(FIXTURES, filename);

      it(
        `${filename} → ${coinExpected ?? 'null'}`,
        async () => {
          const { width, height } = readPngDimensions(filepath);
          const result = await detectCoinTossScreen(worker, filepath, width, height);
          expect(result).toBe(coinExpected);
        },
        60000,
      );
    }
  });
}
