import type { ImageLike, Worker } from 'tesseract.js';

// TODO(DP): DCモードの DP 表示エリアの ROI を確定する。レートの RATING_ROI 相当。
// export const DP_ROI: ROI = { ... };

export async function createDpOcrWorker(): Promise<Worker> {
  const { createWorker } = await import('tesseract.js');
  return createWorker('eng');
}

// プレースホルダ: DCモード（duelists-cup）の DP 自動認識は未実装。常に null を返す。
// 引数は将来の実装（detectRatingFromImageLike と同型）のためにシグネチャを固定する。
export async function detectDpFromImageLike(
  worker: Worker,
  input: ImageLike,
  imageWidth: number,
  imageHeight: number,
): Promise<number | null> {
  // TODO(DP): detectRatingFromImageLike と同様に ROI 切り出し → OCR → パースを実装する。
  void worker;
  void input;
  void imageWidth;
  void imageHeight;
  return null;
}
