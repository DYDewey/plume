import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { greeting, recentSessions, Welcome } from '../src/renderer/src/components/welcome';

describe('Welcome', () => {
  it('logo plume, salutation et bouton principal « Nouvelle conversation »', () => {
    const html = renderToStaticMarkup(<Welcome onNew={() => {}} hour={10} />);
    expect(html).toMatch(/<svg class="logo"/);
    expect(html).toContain('Bonjour, que fait-on ?');
    expect(html).toMatch(/<button[^>]*>.*Nouvelle conversation<\/button>/);
  });

  it('rappelle les raccourcis principaux', () => {
    const html = renderToStaticMarkup(<Welcome onNew={() => {}} hour={10} />);
    expect(html).toContain('paramètres');
    expect(html).toContain('<kbd>N</kbd>');
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

describe('accueil : saisie et récentes', () => {
  it('avec une zone de saisie, plus de gros bouton', () => {
    const html = renderToStaticMarkup(<Welcome onNew={() => {}} hour={10} composer={<textarea />} />);
    expect(html).toContain('welcome-composer');
    expect(html).not.toContain('welcome-new');
  });

  it('3 dernières conversations, sessions techniques exclues, renommage pris en compte', () => {
    const s = (id: string, lastAt: number) => ({ id, title: id, lastAt, messageCount: 2 });
    const projects = [
      { folder: 'C--p', path: 'C:/p', sessions: [s('a', 1), s('b', 5)] },
      { folder: 'C--Users-x--claude-mem-observer-sessions', sessions: [s('obs', 9)] },
      { folder: 'D--q', path: 'D:/q', sessions: [s('c', 3), s('d', 4)] },
    ];
    const organize = { sessions: { 'D--q/d': { title: 'Renommée' } } };
    const recent = recentSessions(projects, organize as never, 10);
    expect(recent.map((r) => r.title)).toEqual(['b', 'Renommée', 'c']);
    expect(recent[0].meta).toMatch(/^p · /);
  });
});
