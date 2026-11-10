import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProjectsList } from '../src/renderer/src/components/projects-list';
import type { HistoryProject } from '../src/shared/history';
import { emptyOrganize, renameSession, toggleFavorite, type OrganizeData } from '../src/shared/organize';
import { addProject } from '../src/shared/projects';

const history: HistoryProject[] = [
  {
    folder: 'D--Cours-react',
    path: 'D:\\Cours\\react',
    sessions: [
      { id: 's1', title: 'Ancienne', lastAt: 100, messageCount: 1 },
      { id: 's2', title: 'Récente', lastAt: 200, messageCount: 1 },
    ],
  },
  { folder: 'D--autre', path: 'D:\\autre', sessions: [{ id: 's3', title: 'Ailleurs', lastAt: 300, messageCount: 1 }] },
];
const noop = () => {};
const render = (organize: OrganizeData, openKey?: string, extra: { openProjectId?: string; missing?: string[] } = {}) =>
  renderToStaticMarkup(
    <ProjectsList
      history={history}
      organize={organize}
      openKey={openKey}
      openProjectId={extra.openProjectId}
      missing={new Set(extra.missing)}
      onOpenProject={noop}
      onOpen={noop}
      onToggleFavorite={noop}
      onNewProject={noop}
      onNewSession={noop}
    />,
  );

const withReact = addProject(emptyOrganize(), 'p_react001', 'D:\\Cours\\react');

describe('ProjectsList', () => {
  it('sans projet : seulement le titre et le bouton « Nouveau projet »', () => {
    const html = render(emptyOrganize());
    expect(html).toContain('Projets');
    expect(html).toContain('aria-label="Nouveau projet"');
    expect(html).not.toContain('<li');
  });

  it('un projet par ligne, avec son bouton de nouvelle session, replié par défaut', () => {
    const html = render(withReact);
    expect(html).toContain('react');
    expect(html).toContain('aria-label="Nouvelle conversation dans « react »"');
    expect(html).not.toContain('Récente');
  });

  it('déplié quand une de ses sessions est ouverte : ses sessions seulement, plus récentes d’abord, avec étoiles et noms', () => {
    const organize = renameSession(toggleFavorite(withReact, 'D--Cours-react/s1'), 'D--Cours-react/s2', 'Mon nom');
    const html = render(organize, 'D--Cours-react/s1');
    expect(html.indexOf('Mon nom')).toBeLessThan(html.indexOf('Ancienne'));
    expect(html).not.toContain('Ailleurs');
    expect(html).toContain('aria-label="Retirer des favoris"');
  });

  it('fiche ouverte : ligne active et sessions dépliées', () => {
    const html = render(withReact, undefined, { openProjectId: 'p_react001' });
    expect(html).toContain('project-row active');
    expect(html).toContain('Récente');
  });

  it('dossier disparu : ligne grisée et nouvelle session désactivée', () => {
    const html = render(withReact, undefined, { missing: ['D:\\Cours\\react'] });
    expect(html).toContain('project-row missing');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Nouvelle conversation/);
  });
});
