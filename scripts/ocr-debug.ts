/**
 * OCR デバッグツール
 *
 * Usage:
 *   npm run ocr-debug -- <image.png> [--jpn]
 *
 * 指定した画像ファイルに対して OCR を実行し、各パスの結果を表示する。
 * --jpn を指定すると日本語 OCR も実行する。
 */
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { createWorker } from 'tesseract.js';
import type { Worker } from 'tesseract.js';
import { parseDetectionResult } from '../src/capture/ocrDetect.ts';
import { normalizeOcrLatinChars, minWordDistance } from '../src/utils/fuzzyText.ts';
import { parseCoinTossText } from '../src/capture/coinTossDetect.ts';

const args = process.argv.slice(2);
const imagePath = args.find((a) => !a.startsWith('--'));
const runJpn = args.includes('--jpn');

if (!imagePath) {
  console.error('Usage: npm run ocr-debug -- <image.png> [--jpn]');
  process.exit(1);
}

const resolved = path.resolve(imagePath);
if (!existsSync(resolved)) {
  console.error(`File not found: ${resolved}`);
  process.exit(1);
}

function readPngDimensions(filepath: string): { width: number; height: number } {
  const buf = readFileSync(filepath).subarray(0, 24);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function printSeparator(label: string) {
  const line = '─'.repeat(60);
  console.log(`\n${line}`);
  console.log(` ${label}`);
  console.log(line);
}

type PSM = Parameters<Worker['setParameters']>[0]['tessedit_pageseg_mode'];

function printOcrResult(pass: string, text: string, confidence: number) {
  const upper = text.toUpperCase();
  const norm = normalizeOcrLatinChars(text);
  const victoryDist = minWordDistance(upper, 'VICTORY');
  const loseDist = minWordDistance(upper, 'LOSE');
  const parsed = parseDetectionResult(text, confidence);

  console.log(`[${pass}]`);
  console.log(`  raw text    : ${JSON.stringify(text.trim())}`);
  console.log(`  normalized  : ${JSON.stringify(norm.trim())}`);
  console.log(`  confidence  : ${confidence.toFixed(1)}`);
  console.log(`  dist VICTORY: ${victoryDist === Infinity ? '∞' : victoryDist}`);
  console.log(`  dist LOSE   : ${loseDist === Infinity ? '∞' : loseDist}`);
  console.log(`  result      : ${parsed ? JSON.stringify(parsed) : 'null'}`);
}

async function runEnglishOcr() {
  const { width, height } = readPngDimensions(resolved);
  printSeparator(`English OCR: ${path.basename(resolved)} (${width}×${height})`);

  const worker = await createWorker('eng');
  try {
    const rect = {
      left: Math.floor(0.125 * width),
      top: Math.floor(0.30 * height),
      width: Math.floor(0.75 * width),
      height: Math.floor(0.32 * height),
    };

    await worker.setParameters({ tessedit_pageseg_mode: '8' as PSM });
    const { data: d1 } = await worker.recognize(resolved, { rectangle: rect });
    printOcrResult('Pass 1: PSM 8 (single word) + ROI', d1.text, d1.confidence);

    await worker.setParameters({ tessedit_pageseg_mode: '7' as PSM });
    const { data: d2 } = await worker.recognize(resolved, { rectangle: rect });
    printOcrResult('Pass 2: PSM 7 (single line) + ROI', d2.text, d2.confidence);

    await worker.setParameters({ tessedit_pageseg_mode: '6' as PSM });
    const { data: d3 } = await worker.recognize(resolved);
    printOcrResult('Pass 3: PSM 6 (block) + full image', d3.text, d3.confidence);
  } finally {
    await worker.terminate();
  }
}

async function runJapaneseOcr() {
  printSeparator(`Japanese OCR: ${path.basename(resolved)}`);

  const worker = await createWorker('jpn');
  try {
    const { data } = await worker.recognize(resolved);
    const parsed = parseCoinTossText(data.text);
    console.log(`  raw text  : ${JSON.stringify(data.text.trim())}`);
    console.log(`  confidence: ${data.confidence.toFixed(1)}`);
    console.log(`  result    : ${parsed ?? 'null'}`);
  } finally {
    await worker.terminate();
  }
}

await runEnglishOcr();
if (runJpn) {
  await runJapaneseOcr();
}
console.log('');
