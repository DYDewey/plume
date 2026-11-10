import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HistoryList } from '../src/renderer/src/components/history-list';
import { isChatFolder, projectName } from '../src/renderer/src/history-groups';
import { emptyOrganize, parseOrganize, renameSession, toggleFavorite, toggleHidden } from '../src/shared/organize';

describe('masquer une conversation', () => {
  it('aller-retour, et les autres champs sont gardés', () => {
    let d = toggleFavorite(emptyOrganize(), 'f/a');
    d = toggleHidden(d, 'f/a');
    expect(d.sessions['f/a']).toEqual({ favorite: true, hidden: true });
    d = renameSession(d, 'f/a', 'Nom');
    expect(d.sessions['f/a']).toEqual({ favorite: true, hidden: true, title: 'Nom' });
    d = toggleHidden(toggleFavorite(renameSession(d, 'f/a', ''), 'f/a'), 'f/a');
    expect(d.sessions['f/a']).toBeUndefined();
  });

  it('relu depuis organize.json', () => {
    const d = parseOrganize(JSON.stringify({ version: 1, sessions: { 'f/a': { hidden: true }, 'f/b': { hidden: 'oui' } } }));
    expect(d?.sessions).toEqual({ 'f/a': { hidden: true } });
  });

  it('la liste range les masquées à part', () => {
    const projects = [{ folder: 'C--p', path: 'C:/p', sessions: [{ id: 'a', title: 'Visible', lastAt: 2, messageCount: 1 }, { id: 'b', title: 'Cachée', lastAt: 1, messageCount: 1 }] }];
    const organize = toggleHidden(emptyOrganize(), 'C--p/b');
    const html = renderToStaticMarkup(<HistoryList projects={projects} now={3} onOpen={() => {}} onRefresh={() => {}} organize={organize} />);
    expect(html).toContain('Masquées (1)');
    expect(html.indexOf('Cachée')).toBeGreaterThan(html.indexOf('Masquées (1)'));
    expect(html.indexOf('Visible')).toBeLessThan(html.indexOf('Masquées (1)'));
  });
});

describe('discussions sans dossier', () => {
  it('reconnues par le nom encodé ou le chemin, affichées « Discussion »', () => {
    expect(isChatFolder({ folder: 'C--Users-x-AppData-Roaming-mon-claude-discussions' })).toBe(true);
    expect(isChatFolder({ folder: 'x', path: 'C:/Users/x/AppData/Roaming/mon-claude/discussions' })).toBe(true);
    expect(projectName({ folder: 'C--Users-x-AppData-Roaming-mon-claude-discussions' })).toBe('Discussion');
    expect(projectName({ folder: 'D--q', path: 'D:/Cours/maths' })).toBe('maths');
  });
});
