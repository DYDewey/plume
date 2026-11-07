import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HistoryView } from '../src/renderer/src/components/history-view';

const base = { title: 'Module usage', path: 'C:\\dev\\proj' };

describe('HistoryView', () => {
  it('propose « Continuer », désactivé si le dossier a disparu', () => {
    const ok = renderToStaticMarkup(<HistoryView title="t" items={[]} onContinue={() => {}} />);
    expect(ok).toContain('Continuer');
    expect(ok).not.toContain('disabled');
    const gone = renderToStaticMarkup(<HistoryView title="t" items={[]} onContinue={() => {}} folderMissing />);
    expect(gone).toContain('disabled');
    expect(gone).toContain('Dossier introuvable');
  });

  it('affiche les messages avec un bandeau Lecture seule, sans zone de saisie', () => {
    const html = renderToStaticMarkup(
      <HistoryView {...base} items={[{ kind: 'user', text: 'bonjour' }, { kind: 'assistant', text: '**salut**' }]} />,
    );
    expect(html).toContain('Module usage');
    // Seul le nom du dossier s'affiche ; le chemin complet est en infobulle.
    expect(html).toMatch(/title="C:\\dev\\proj"[^>]*>proj</);
    expect(html).toContain('Lecture seule');
    expect(html).toContain('bonjour');
    expect(html).toContain('<strong>salut</strong>');
    expect(html).not.toContain('<textarea');
  });

  it("n'affiche pas le dossier s'il répète le titre", () => {
    const html = renderToStaticMarkup(<HistoryView title="proj" path="C:\\dev\\proj" items={[]} />);
    expect(html).not.toContain('topbar-folder');
  });

  it('étoile et crayon dans l’en-tête quand le rangement est branché', () => {
    const noop = () => {};
    const html = renderToStaticMarkup(
      <HistoryView {...base} items={[]} favorite onToggleFavorite={noop} onRename={noop} />,
    );
    expect(html).toContain('aria-label="Retirer des favoris"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-label="Renommer"');
  });

  it('sans rangement branché : ni étoile ni crayon', () => {
    const html = renderToStaticMarkup(<HistoryView {...base} items={[]} />);
    expect(html).not.toContain('favoris');
    expect(html).not.toContain('Renommer');
  });

  it('pendant le chargement, puis en cas d\'erreur', () => {
    expect(renderToStaticMarkup(<HistoryView {...base} />)).toContain('Chargement…');
    expect(renderToStaticMarkup(<HistoryView {...base} error="fichier introuvable" />)).toContain('fichier introuvable');
  });
});

describe('HistoryView focusIndex', () => {
  const items = [
    { kind: 'user' as const, text: 'question' },
    { kind: 'tool' as const, name: 'Bash', input: {} },
    { kind: 'assistant' as const, text: 'réponse trouvée' },
  ];
  it('surligne le message trouvé, et lui seul', () => {
    const html = renderToStaticMarkup(<HistoryView {...base} items={items} focusIndex={2} />);
    expect(html.match(/msg-found/g)).toHaveLength(1);
    expect(html).toMatch(/msg-claude msg-found"><p>réponse trouvée/);
  });
  it('aucun surlignage sans focusIndex', () => {
    expect(renderToStaticMarkup(<HistoryView {...base} items={items} />)).not.toContain('msg-found');
  });
});
