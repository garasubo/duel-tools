import { describe, expect, it } from 'vitest';
import { createMemoShot, removeMemoShot } from './captureMemo';

describe('createMemoShot', () => {
  it('dataUrl と createdAt を保持し、id を付与する', () => {
    const shot = createMemoShot('data:image/png;base64,abc', 1000);
    expect(shot.dataUrl).toBe('data:image/png;base64,abc');
    expect(shot.createdAt).toBe(1000);
    expect(shot.id).toBeTruthy();
  });

  it('生成するたびに異なる id を返す', () => {
    const a = createMemoShot('data:image/png;base64,a', 1);
    const b = createMemoShot('data:image/png;base64,b', 1);
    expect(a.id).not.toBe(b.id);
  });
});

describe('removeMemoShot', () => {
  it('指定した id の要素だけを除いた新しい配列を返す', () => {
    const a = createMemoShot('a', 1);
    const b = createMemoShot('b', 2);
    const c = createMemoShot('c', 3);
    const result = removeMemoShot([a, b, c], b.id);
    expect(result).toEqual([a, c]);
  });

  it('一致する id がなければ全要素をそのまま返す', () => {
    const a = createMemoShot('a', 1);
    const result = removeMemoShot([a], 'missing');
    expect(result).toEqual([a]);
  });

  it('空配列を渡しても空配列を返す', () => {
    expect(removeMemoShot([], 'x')).toEqual([]);
  });
});
