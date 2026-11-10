import { describe, expect, it } from 'vitest';
import { ARTIFACT_INSTRUCTIONS, joinPrompts } from '../src/shared/artifacts';
import { artifactsInText, lastArtifact } from '../src/shared/auto-artifact';
import type { ChatItem } from '../src/shared/chat-item';

const block = (lang: string, code: string) => '```' + lang + '\n' + code + '\n```';

describe('artifactsInText', () => {
  it('garde les blocs html, svg et mermaid, ignore le reste', () => {
    const text = ['Voici :', block('ts', 'const a = 1'), block('mermaid', 'graph TD; A-->B'), 'et', block('html', '<title>Jeu</title><p>x</p>')].join('\n');
    expect(artifactsInText(text).map((a) => [a.kind, a.title, a.code])).toEqual([
      ['mermaid', 'Diagramme', 'graph TD; A-->B'],
      ['html', 'Jeu', '<title>Jeu</title><p>x</p>'],
    ]);
  });

  it('bloc pas encore fermé (réponse en cours) : rien', () => {
    expect(artifactsInText('```html\n<p>x</p>')).toEqual([]);
  });
});

describe('lastArtifact', () => {
  it('dernier artefact de la dernière réponse seulement', () => {
    const items: ChatItem[] = [
      { kind: 'user', text: 'a' },
      { kind: 'assistant', text: block('svg', '<svg/>') },
      { kind: 'user', text: 'b' },
      { kind: 'assistant', text: 'rien à montrer' },
    ];
    expect(lastArtifact(items)).toBeNull();
    expect(lastArtifact(items.slice(0, 2))?.kind).toBe('svg');
  });

  it('sinon une page HTML écrite par Claude', () => {
    const items: ChatItem[] = [
      { kind: 'user', text: 'fais une page' },
      { kind: 'tool', name: 'Write', input: { file_path: 'C:\\p\\jeu.html', content: '<p>jeu</p>' } },
      { kind: 'assistant', text: 'Fini.' },
    ];
    expect(lastArtifact(items)).toEqual({ kind: 'html', title: 'jeu.html', code: '<p>jeu</p>' });
  });
});

describe('consigne', () => {
  it('jointe aux instructions du projet, vides ignorées', () => {
    expect(joinPrompts('Projet X', null, ARTIFACT_INSTRUCTIONS)).toBe(`Projet X\n\n${ARTIFACT_INSTRUCTIONS}`);
    expect(joinPrompts(null, '  ')).toBeNull();
  });

  it('parle des trois formats et des CDN autorisés', () => {
    for (const word of ['```mermaid', '```svg', '```html', 'cdn.jsdelivr.net']) expect(ARTIFACT_INSTRUCTIONS).toContain(word);
  });
});
