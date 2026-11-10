import { describe, expect, it } from 'vitest';
import { ARTIFACT_CSP, artifactFileName, artifactKind, artifactPage, artifactTitle, langOfPath, MERMAID_URL } from '../src/shared/artifacts';

describe('artifactKind', () => {
  it('reconnaît HTML, SVG et Mermaid', () => {
    expect(artifactKind('html', '<p>x</p>')).toBe('html');
    expect(artifactKind('svg', '<svg></svg>')).toBe('svg');
    expect(artifactKind('xml', '<?xml version="1.0"?>\n<svg viewBox="0 0 1 1"/>')).toBe('svg');
    expect(artifactKind('mermaid', 'graph TD; A-->B')).toBe('mermaid');
  });

  it('le reste n’est pas un artefact', () => {
    expect(artifactKind('ts', 'const a = 1')).toBeNull();
    expect(artifactKind('html', 'pas de balise')).toBeNull();
    expect(artifactKind('xml', '<root/>')).toBeNull();
  });
});

describe('artifactPage', () => {
  it('HTML tel quel, SVG enveloppé', () => {
    expect(artifactPage('html', '<b>x</b>')).toBe('<b>x</b>');
    expect(artifactPage('svg', '<svg/>')).toContain('<body><svg/></body>');
  });

  it('Mermaid : version fixée, code échappé', () => {
    const page = artifactPage('mermaid', 'A-->B<script>');
    expect(page).toContain(MERMAID_URL);
    expect(MERMAID_URL).toMatch(/mermaid@\d+\.\d+\.\d+\//);
    expect(page).toContain('A--&gt;B&lt;script&gt;');
  });
});

describe('sécurité', () => {
  it('aucune requête réseau depuis les scripts de la page', () => {
    expect(ARTIFACT_CSP).toContain("connect-src 'none'");
    expect(ARTIFACT_CSP).toContain("default-src 'none'");
  });
});

describe('noms', () => {
  it('titre de la page, sinon générique', () => {
    expect(artifactTitle('html', '<title> Mon jeu </title>')).toBe('Mon jeu');
    expect(artifactTitle('html', '<p/>')).toBe('Page HTML');
    expect(artifactTitle('mermaid', 'x')).toBe('Diagramme');
  });

  it('nom de fichier sans accents ni espaces', () => {
    expect(artifactFileName({ kind: 'html', title: 'Mon Été !', code: '' })).toBe('mon-ete.html');
    expect(artifactFileName({ kind: 'mermaid', title: 'Diagramme', code: '' })).toBe('diagramme.mmd');
  });

  it('extension d’un chemin', () => {
    expect(langOfPath('C:\\p\\Page.HTML')).toBe('html');
    expect(langOfPath('Makefile')).toBe('');
  });
});
