import { describe, expect, it, vi } from 'vitest';
import {
  POST_DUEL_BRIGHTNESS_THRESHOLD,
  isPostDuelDark,
  sampleScreenBrightness,
} from './postDuelDetect';

function makeCanvas(rgb: [number, number, number], width = 100, height = 100): HTMLCanvasElement {
  const canvas = {
    width,
    height,
    getContext: vi.fn().mockReturnValue({
      getImageData: vi.fn().mockReturnValue({
        data: new Uint8ClampedArray(width * height * 4).fill(0).map((_, i) => {
          const ch = i % 4;
          if (ch === 3) return 255; // alpha
          return rgb[ch];
        }),
        width,
        height,
      }),
    }),
  } as unknown as HTMLCanvasElement;
  return canvas;
}

describe('sampleScreenBrightness', () => {
  it('全黒画像は 0 を返す', () => {
    const canvas = makeCanvas([0, 0, 0]);
    expect(sampleScreenBrightness(canvas)).toBeCloseTo(0);
  });

  it('全白画像は 1 を返す', () => {
    const canvas = makeCanvas([255, 255, 255]);
    expect(sampleScreenBrightness(canvas)).toBeCloseTo(1);
  });

  it('50% グレーは 0.5 付近を返す', () => {
    const canvas = makeCanvas([128, 128, 128]);
    expect(sampleScreenBrightness(canvas)).toBeGreaterThan(0.49);
    expect(sampleScreenBrightness(canvas)).toBeLessThan(0.51);
  });

  it('getContext が null の場合は 1.0 を返す', () => {
    const canvas = { width: 100, height: 100, getContext: () => null } as unknown as HTMLCanvasElement;
    expect(sampleScreenBrightness(canvas)).toBe(1.0);
  });
});

describe('isPostDuelDark', () => {
  it('全黒画像（暗転）は true を返す', () => {
    expect(isPostDuelDark(makeCanvas([0, 0, 0]))).toBe(true);
  });

  it('閾値未満の暗い画像は true を返す', () => {
    // 閾値 0.15 未満 → 輝度 = 30/255 ≈ 0.118
    expect(isPostDuelDark(makeCanvas([30, 30, 30]))).toBe(true);
  });

  it('明るい画像（VICTORY バナー相当）は false を返す', () => {
    expect(isPostDuelDark(makeCanvas([200, 200, 200]))).toBe(false);
  });

  it(`閾値 ${POST_DUEL_BRIGHTNESS_THRESHOLD} のちょうど上は false を返す`, () => {
    // 0.15 * 255 ≈ 38.25 → 39 なら閾値超え
    expect(isPostDuelDark(makeCanvas([39, 39, 39]))).toBe(false);
  });
});
