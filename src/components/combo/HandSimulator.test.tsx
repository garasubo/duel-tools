import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import HandSimulator, { SimulationResults, type SimulationRow } from './HandSimulator';

describe('HandSimulator', () => {
  it('条件未登録でも実行でき、初期回数とダミー補完を案内する', () => {
    const html = renderToStaticMarkup(<HandSimulator deckCounts={{ A: 3 }} deckSize={40} patterns={[]} cardLabels={{}} />);
    expect(html).toContain('value="10"');
    expect(html).toContain('残り 37 枚はダミーカード');
    expect(html).not.toContain('disabled=""');
  });

  it('カード未登録では実行できず、理由を表示する', () => {
    const html = renderToStaticMarkup(<HandSimulator deckCounts={{}} deckSize={40} patterns={[]} cardLabels={{}} />);
    expect(html).toContain('カードを1枚以上追加してください');
    expect(html).toContain('disabled=""');
  });
});

describe('SimulationResults', () => {
  const rows: SimulationRow[] = [
    { hand: ['A', 'A', 'B', null, null], matchedPatterns: [1, 3] },
    { hand: ['B', 'B', 'B', null, null], matchedPatterns: [] },
  ];
  it('手札の重複カード・ダミー・成立した全条件・不成立を表示する', () => {
    const html = renderToStaticMarkup(<SimulationResults rows={rows} hasPatterns page={0} onPageChange={() => {}} />);
    expect(html).toContain('成立: 条件 1、条件 3');
    expect(html).toContain('成立なし');
    expect(html.match(/>A<\/li>/g)).toHaveLength(2);
    expect(html.match(/>ダミーカード<\/li>/g)).toHaveLength(4);
    expect(html).not.toContain('次へ');
  });

  it('条件未登録では不成立と区別して表示する', () => {
    const html = renderToStaticMarkup(<SimulationResults rows={[rows[1]]} hasPatterns={false} page={0} onPageChange={() => {}} />);
    expect(html).toContain('条件未設定');
    expect(html).not.toContain('成立なし');
  });

  it('50件でページを区切り、末尾では次へを無効にする', () => {
    const manyRows = Array.from({ length: 51 }, () => rows[0]);
    const first = renderToStaticMarkup(<SimulationResults rows={manyRows} hasPatterns page={0} onPageChange={() => {}} />);
    const last = renderToStaticMarkup(<SimulationResults rows={manyRows} hasPatterns page={1} onPageChange={() => {}} />);
    expect(first.match(/aria-label="手札5枚"/g)).toHaveLength(50);
    expect(first).toContain('50回目');
    expect(first).not.toContain('51回目');
    expect(first).toMatch(/disabled="">前へ/);
    expect(last.match(/aria-label="手札5枚"/g)).toHaveLength(1);
    expect(last).toContain('51回目');
    expect(last).toContain('2 / 2ページ');
    expect(last).toMatch(/disabled="">次へ/);
  });
});
