import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HistoryList, projectLabel } from '../src/renderer/src/components/history-list';
import type { HistoryProject } from '../src/shared/history';
import { emptyOrganize, renameSession, toggleFavorite } from '../src/shared/organize';

const NOW = Date.parse('2026-10-24T12:00:00Z');
const projects: HistoryProject[] = [
  {
    folder: 'C--Users-moi-Documents-mon-claude',
    path: 'C:\\Users\\moi\\Documents\\mon-claude',
    sessions: [
      { id: 's2', title: 'Module usage', lastAt: NOW - 2 * 86_400_000, messageCount: 12 },
      { id: 's1', title: 'Spec <chat>', lastAt: NOW - 3 * 3_600_000, messageCount: 4 },
    ],
  },
  { folder: 'D--Cours', sessions: [{ id: 'x', title: 'Oral', lastAt: NOW, messageCount: 1 }] },
];

const noop = () => {};
const render = (openKey?: string) =>
  renderToStaticMarkup(
    <HistoryList projects={projects} now={NOW} openKey={openKey} onOpen={noop} onRefresh={noop} />,
  );

describe('projectLabel', () => {
  it('dernier dossier du vrai chemin, sinon nom du dossier encodé', () => {
    expect(projectLabel(projects[0])).toBe('mon-claude');
    expect(projectLabel(projects[1])).toBe('D--Cours');
  });
});

describe('HistoryList', () => {
  it('rangé par date, tous projets mêlés, plus récent d’abord', () => {
    const html = render();
    expect(html).not.toContain('<details');
    expect(html.indexOf('Aujourd&#x27;hui')).toBeLessThan(html.indexOf('7 derniers jours'));
    expect(html.indexOf('Oral')).toBeLessThan(html.indexOf('Spec &lt;chat&gt;'));
    expect(html.indexOf('Spec &lt;chat&gt;')).toBeLessThan(html.indexOf('Module usage'));
  });

  it('chaque session : titre (échappé) et nom court du projet', () => {
    const html = render();
    expect(html).toContain('Module usage');
    expect(html).toContain('Spec &lt;chat&gt;');
    expect(html).toMatch(/history-meta">mon-claude · /);
  });

  it('la session ouverte est marquée', () => {
    const html = render('C--Users-moi-Documents-mon-claude/s1');
    expect(html.match(/class="history-item active"/g)).toHaveLength(1);
  });

  it('masque les sessions techniques (claude-mem) sauf si le réglage les montre', () => {
    const withTech = [...projects, { folder: 'C--Users-moi--claude-mem-observer', sessions: [{ id: 't', title: 'Observateur', lastAt: NOW, messageCount: 1 }] }];
    const hidden = renderToStaticMarkup(<HistoryList projects={withTech} now={NOW} onOpen={noop} onRefresh={noop} />);
    expect(hidden).not.toContain('Observateur');
    const shown = renderToStaticMarkup(<HistoryList projects={withTech} now={NOW} onOpen={noop} onRefresh={noop} showTechnical />);
    expect(shown).toContain('Observateur');
  });

  it('a un champ de recherche', () => {
    expect(render()).toMatch(/<input[^>]*type="search"[^>]*aria-label="Rechercher dans l&#x27;historique"/);
  });

  it('une recherche ne garde que les sessions qui correspondent', () => {
    const html = renderToStaticMarkup(
      <HistoryList projects={projects} now={NOW} onOpen={noop} onRefresh={noop} initialQuery="USAGE" />,
    );
    expect(html).toContain('Module usage');
    expect(html).not.toContain('Spec &lt;chat&gt;');
    expect(html).not.toContain('Oral');
  });

  it('« Aucun résultat » quand rien ne correspond', () => {
    const html = renderToStaticMarkup(
      <HistoryList projects={projects} now={NOW} onOpen={noop} onRefresh={noop} initialQuery="zzz" />,
    );
    expect(html).toContain('Aucun résultat');
    expect(html).not.toContain('history-group');
  });

  it('affiche le nom personnalisé à la place du titre, et un crayon par session', () => {
    const organize = renameSession(emptyOrganize(), 'D--Cours/x', 'Oral de maths');
    const html = renderToStaticMarkup(
      <HistoryList projects={projects} now={NOW} onOpen={noop} onRefresh={noop} organize={organize} />,
    );
    expect(html).toContain('Oral de maths');
    expect(html).not.toContain('>Oral<');
    expect(html.match(/aria-label="Renommer"/g)).toHaveLength(3);
  });

  it('la recherche trouve le nom personnalisé', () => {
    const organize = renameSession(emptyOrganize(), 'D--Cours/x', 'Promesses JS');
    const html = renderToStaticMarkup(
      <HistoryList projects={projects} now={NOW} onOpen={noop} onRefresh={noop} organize={organize} initialQuery="promesses js" />,
    );
    expect(html).toContain('Promesses JS');
    expect(html).not.toContain('Module usage');
  });

  it('chaque session a une étoile ; pleine (aria-pressed) seulement pour un favori', () => {
    const organize = toggleFavorite(emptyOrganize(), 'D--Cours/x');
    const html = renderToStaticMarkup(
      <HistoryList projects={projects} now={NOW} onOpen={noop} onRefresh={noop} organize={organize} onToggleFavorite={noop} />,
    );
    expect(html.match(/aria-label="Ajouter aux favoris"/g)).toHaveLength(2);
    expect(html.match(/aria-label="Retirer des favoris"/g)).toHaveLength(1);
    expect(html).toContain('aria-pressed="true"');
  });
});
