import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import BrandLogo from './BrandLogo';

describe('BrandLogo', () => {
  it('ブランドシンボルと表記をホームへのリンクとして表示する', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <BrandLogo />
      </MemoryRouter>,
    );

    expect(html).toContain('href="/record"');
    expect(html).toContain(
      `src="${import.meta.env.BASE_URL}favicon.svg"`,
    );
    expect(html).toContain('DuelTools');
    expect(html).toContain('aria-label="DuelTools ホーム"');
  });
});
