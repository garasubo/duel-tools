const SAMPLE_STEP = 8;

export const POST_DUEL_BRIGHTNESS_THRESHOLD = 0.15;

/** 0..1 のスケールでキャンバス全体の平均輝度を返す */
export function sampleScreenBrightness(
  canvas: HTMLCanvasElement,
  step = SAMPLE_STEP,
): number {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 1.0;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let sum = 0;
  let count = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
      count++;
    }
  }
  return count > 0 ? sum / count / 255 : 1.0;
}

/** 画面が「デュエル後の暗い状態（暗転 or リザルト/ロビー画面）」かどうかを返す */
export function isPostDuelDark(canvas: HTMLCanvasElement): boolean {
  return sampleScreenBrightness(canvas) < POST_DUEL_BRIGHTNESS_THRESHOLD;
}
