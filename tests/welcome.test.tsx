import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { greeting, Welcome } from '../src/renderer/src/components/welcome';

describe('Welcome', () => {
  it('logo « C », salutation et bouton principal « Nouvelle conversation »', () => {
    const html = renderToStaticMarkup(<Welcome onNew={() => {}} hour={10} />);
    expect(html).toMatch(/class="logo"[^>]*>C</);
    expect(html).toContain('Bonjour, que fait-on ?');
    expect(html).toMatch(/<button[^>]*>.*Nouvelle conversation<\/button>/);
  });

  it('rappelle les raccourcis principaux', () => {
    const html = renderToStaticMarkup(<Welcome onNew={() => {}} hour={10} />);
    expect(html).toContain('paramètres');
    expect(html).toContain('<kbd>B</kbd>');
  });
});

describe('greeting', () => {
  it('Bonjour de 5 h à 18 h, Bonsoir sinon', () => {
    expect(greeting(5)).toBe('Bonjour');
    expect(greeting(17)).toBe('Bonjour');
    expect(greeting(18)).toBe('Bonsoir');
    expect(greeting(2)).toBe('Bonsoir');
  });
});
