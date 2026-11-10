import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Logo, LOGO_PATHS } from '../src/renderer/src/components/logo';

describe('logo', () => {
  it('mêmes tracés que resources/logo.svg (icône Windows)', () => {
    const svg = readFileSync('resources/logo.svg', 'utf8');
    for (const d of Object.values(LOGO_PATHS)) expect(svg).toContain(`d="${d}"`);
  });

  it('deux logos à l’écran ont chacun leur dégradé', () => {
    const html = renderToStaticMarkup(<><Logo /><Logo /></>);
    const ids = [...html.matchAll(/linearGradient id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(2);
  });
});
