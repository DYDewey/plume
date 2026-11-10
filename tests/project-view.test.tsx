import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { nameChange, ProjectView, TopbarProject } from '../src/renderer/src/components/project-view';
import { emptyOrganize } from '../src/shared/organize';
import { addProject, updateProject, type Project } from '../src/shared/projects';

const project: Project = {
  name: 'Cours React',
  folder: 'D:\\Cours\\react',
  instructions: 'Explique simplement',
  files: ['D:\\Cours\\react\\sujet.pdf', 'D:\\absent.pdf'],
};
const noop = () => {};
const render = (missing: string[] = []) =>
  renderToStaticMarkup(
    <ProjectView
      project={project}
      missing={new Set(missing)}
      onChange={noop}
      onPickFiles={() => Promise.resolve([])}
      onNewSession={noop}
      onDelete={noop}
    />,
  );

describe('ProjectView', () => {
  it('affiche nom, dossier, instructions et fichiers', () => {
    const html = render();
    expect(html).toContain('value="Cours React"');
    expect(html).toContain('D:\\Cours\\react');
    expect(html).toContain('Explique simplement');
    expect(html).toContain('sujet.pdf');
    expect(html).toContain('aria-label="Retirer sujet.pdf"');
    expect(html).toContain('prochains lancements');
  });

  it('fichier disparu : barré', () => {
    const html = render(['D:\\absent.pdf']);
    expect(html).toMatch(/<li class="missing"[^>]*>.*absent\.pdf/);
    expect(html).not.toMatch(/<li class="missing"[^>]*>[^<]*<span[^>]*>[^<]*sujet\.pdf/);
  });

  it('dossier disparu : nouvelle session désactivée et message', () => {
    const html = render(['D:\\Cours\\react']);
    expect(html).toContain('Dossier introuvable');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[^]*?Nouvelle conversation/);
  });

  it('dossier présent : nouvelle session active', () => {
    expect(render()).not.toContain('disabled=""');
  });

  it('instructions limitées à 10 000 caractères dans le champ', () => {
    expect(render()).toContain('maxLength="10000"');
  });
});

describe('nameChange', () => {
  it('nouveau nom, sans les espaces autour', () => {
    expect(nameChange('  Cours Vue ', 'Cours React')).toBe('Cours Vue');
  });

  it('nom vidé ou inchangé : rien à enregistrer (le champ revient au nom actuel)', () => {
    expect(nameChange('   ', 'Cours React')).toBeNull();
    expect(nameChange(' Cours React ', 'Cours React')).toBeNull();
  });
});

describe('TopbarProject', () => {
  const empty = addProject(emptyOrganize(), 'p_react001', 'D:\\Cours\\react');
  const withText = updateProject(empty, 'p_react001', { name: 'Cours React', instructions: 'Sois bref' });

  it('nom du projet quand ses instructions sont envoyées', () => {
    expect(renderToStaticMarkup(<TopbarProject organize={withText} cwd="d:\cours\react\" />)).toContain('Projet : Cours React');
  });

  it('rien hors projet, ni pour un projet sans instructions ni fichiers', () => {
    expect(renderToStaticMarkup(<TopbarProject organize={withText} cwd="D:\autre" />)).toBe('');
    expect(renderToStaticMarkup(<TopbarProject organize={empty} cwd="D:\Cours\react" />)).toBe('');
  });
});
