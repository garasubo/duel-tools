/**
 * OCR でよく混同されるラテン文字・数字を正規化する。
 * 0→O, 1→I, 5→S, l→L などのよくある OCR 誤認識に対応。
 */
export function normalizeOcrLatinChars(text: string): string {
  return text
    .toUpperCase()
    .replace(/0/g, 'O')
    .replace(/1/g, 'I')
    .replace(/5/g, 'S')
    .replace(/\|/g, 'I')
    .replace(/\$/g, 'S');
}

/**
 * 2 つの文字列間の Levenshtein 距離を計算する。
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] =
        a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

/**
 * テキストから英数字のトークンを抽出し、target との最小 Levenshtein 距離を返す。
 * テキストが空または一致するトークンがない場合は Infinity を返す。
 */
export function minWordDistance(text: string, target: string): number {
  const words = text.match(/[A-Z0-9]{2,}/gi) ?? [];
  if (words.length === 0) return Infinity;
  return Math.min(...words.map((w) => levenshtein(w.toUpperCase(), target.toUpperCase())));
}
