/**
 * OCR バッチテストツール
 *
 * Usage:
 *   npm run ocr-batch [-- <fixtures-dir>]
 *
 * fixtures/ ディレクトリ内の PNG ファイルを命名規則で分類し、
 * OCR の検出結果と期待値を比較してテーブル形式で表示する。
 *
 * 命名規則:
 *   result_win_*.png    → 期待: win
 *   result_lose_*.png   → 期待: loss
 *   no_result_*.png     → 期待: null
 *   coin_win_001.png    → 期待: user-selecting
 *   coin_win_002.png    → 期待: you-are-first
 *   coin_lose_001.png   → 期待: opponent-selecting
 *   coin_lose_002.png   → 期待: you-are-second
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import path from 'path';
import { createWorker } from 'tesseract.js';
import { detectWithOcrWorker } from '../src/capture/ocrDetect.ts';
import { parseCoinTossText } from '../src/capture/coinTossDetect.ts';

const customDir = process.argv[2];
const FIXTURES = customDir
  ? path.resolve(customDir)
  : path.resolve(import.meta.dirname, '../src/capture/fixtures');

if (!existsSync(FIXTURES)) {
  console.error(`Fixtures directory not found: ${FIXTURES}`);
  process.exit(1);
}

function readPngDimensions(filepath: string): { width: number; height: number } {
  const buf = readFileSync(filepath).subarray(0, 24);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

type ExpectedResult = 'win' | 'loss' | null | string;

function classifyFile(filename: string): ExpectedResult | undefined {
  if (filename.startsWith('result_win_')) return 'win';
  if (filename.startsWith('result_lose_')) return 'loss';
  if (filename.startsWith('no_result_')) return null;
  if (filename === 'coin_win_001.png') return 'user-selecting';
  if (filename === 'coin_win_002.png') return 'you-are-first';
  if (filename === 'coin_lose_001.png') return 'opponent-selecting';
  if (filename === 'coin_lose_002.png') return 'you-are-second';
  return undefined;
}

function isCoinFile(filename: string): boolean {
  return filename.startsWith('coin_');
}

interface Row {
  file: string;
  expected: string;
  actual: string;
  pass: boolean;
}

const files = readdirSync(FIXTURES)
  .filter((f) => f.endsWith('.png') && classifyFile(f) !== undefined)
  .sort();

if (files.length === 0) {
  console.log('No fixture files found in:', FIXTURES);
  process.exit(0);
}

console.log(`\nRunning OCR on ${files.length} fixture(s) in ${FIXTURES}\n`);

const rows: Row[] = [];

// English OCR worker for result screens
const engWorker = await createWorker('eng');
// Japanese OCR worker for coin toss screens
const coinFiles = files.filter(isCoinFile);
const jpnWorker = coinFiles.length > 0 ? await createWorker('jpn') : null;

try {
  for (const file of files) {
    const filepath = path.join(FIXTURES, file);
    const expected = classifyFile(file);
    const expectedStr = expected === null ? 'null' : (expected ?? '?');

    process.stdout.write(`  ${file.padEnd(30)} ...`);

    let actualStr: string;
    if (isCoinFile(file)) {
      const { data } = await jpnWorker!.recognize(filepath);
      const result = parseCoinTossText(data.text);
      actualStr = result ?? 'null';
    } else {
      const { width, height } = readPngDimensions(filepath);
      const result = await detectWithOcrWorker(engWorker, filepath, width, height);
      actualStr = result ? result.result : 'null';
    }

    const pass = actualStr === expectedStr;
    rows.push({ file, expected: expectedStr, actual: actualStr, pass });
    console.log(pass ? ' ✓' : ` ✗  (expected: ${expectedStr}, got: ${actualStr})`);
  }
} finally {
  await engWorker.terminate();
  if (jpnWorker) await jpnWorker.terminate();
}

const passed = rows.filter((r) => r.pass).length;
const failed = rows.filter((r) => !r.pass).length;

console.log('\n' + '─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log('\nFailed files:');
  rows
    .filter((r) => !r.pass)
    .forEach((r) => console.log(`  ${r.file}: expected=${r.expected} actual=${r.actual}`));
  process.exit(1);
}
