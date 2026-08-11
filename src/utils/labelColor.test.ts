import { describe, it, expect } from 'vitest';
import { getLabelColor } from './labelColor';

describe('getLabelColor', () => {
  it('returns the same color for the same label', () => {
    expect(getLabelColor('初動')).toEqual(getLabelColor('初動'));
  });

  it('assigns distinct colors to different labels', () => {
    const a = getLabelColor('手札誘発');
    const b = getLabelColor('展開');
    expect(a).not.toEqual(b);
  });

  it('always returns a complete color set with tailwind class strings', () => {
    const color = getLabelColor('サンプル');
    expect(color.bg).toMatch(/^bg-/);
    expect(color.text).toMatch(/^text-/);
    expect(color.border).toMatch(/^border-/);
    expect(color.removeText).toMatch(/^text-/);
    expect(color.removeHover).toMatch(/^hover:text-/);
  });
});
