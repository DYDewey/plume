import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { codeLanguage, hastText, Markdown } from '../src/renderer/src/components/message';

const html = (text: string) => renderToStaticMarkup(<Markdown text={text} />);

describe('Markdown', () => {
  it('une liste devient une vraie liste', () => {
    expect(html('- un\n- deux')).toContain('<li>un</li>');
  });

  it('un bloc de code est coloré', () => {
    expect(html('```ts\nconst a = 1;\n```')).toContain('hljs-keyword');
  });

  it('un bloc de code a son langage et un bouton Copier', () => {
    const out = html('```python\nprint("x")\n```');
    expect(out).toContain('class="code-lang">python<');
    expect(out).toContain('aria-label="Copier le code"');
  });

  it('bloc sans langage : « code »', () => {
    expect(html('```\nabc\n```')).toContain('class="code-lang">code<');
  });

  it('le texte copié est le code brut, sans coloration', () => {
    const pre = { type: 'element', tagName: 'pre', children: [{ type: 'element', tagName: 'code', properties: { className: ['hljs', 'language-ts'] },
      children: [{ type: 'element', tagName: 'span', children: [{ type: 'text', value: 'const' }] }, { type: 'text', value: ' a = 1;\n' }] }] };
    expect(hastText(pre)).toBe('const a = 1;\n');
    expect(codeLanguage(pre)).toBe('ts');
  });

  it('les tableaux GFM sont rendus', () => {
    expect(html('| a | b |\n|---|---|\n| 1 | 2 |')).toContain('<table>');
  });

  it('le HTML brut n\'est jamais interprété', () => {
    expect(html('<img src=x onerror="alert(1)">')).not.toContain('<img');
  });
});
