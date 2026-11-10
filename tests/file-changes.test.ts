import { describe, expect, it } from 'vitest';
import type { ChatItem } from '../src/shared/chat-item';
import { fileChanges, lineDiff, turnRanges, withContext } from '../src/shared/file-changes';

describe('lineDiff', () => {
  it('lignes communes, retirées et ajoutées', () => {
    expect(lineDiff('a\nb\nc', 'a\nB\nc\nd')).toEqual([
      { type: 'same', text: 'a' },
      { type: 'del', text: 'b' },
      { type: 'add', text: 'B' },
      { type: 'same', text: 'c' },
      { type: 'add', text: 'd' },
    ]);
  });

  it('texte vide : tout ajouté', () => {
    expect(lineDiff('', 'x\ny')).toEqual([{ type: 'add', text: 'x' }, { type: 'add', text: 'y' }]);
  });

  it('très gros fichiers : pas de calcul géant', () => {
    const big = Array.from({ length: 1000 }, (_, i) => `l${i}`).join('\n');
    const d = lineDiff(big, big + '\nfin');
    expect(d.filter((l) => l.type === 'add')).toHaveLength(1001);
  });
});

describe('fileChanges', () => {
  const tool = (name: string, input: Record<string, unknown>): ChatItem => ({ kind: 'tool', name, input });

  it('regroupe par fichier (casse ignorée) et compte les lignes', () => {
    const changes = fileChanges([
      tool('Read', { file_path: 'C:/p/a.ts' }),
      tool('Edit', { file_path: 'C:/p/a.ts', old_string: 'x', new_string: 'y' }),
      tool('Edit', { file_path: 'c:/p/A.ts', old_string: 'z', new_string: 'z\nw' }),
      tool('MultiEdit', { file_path: 'C:/p/b.ts', edits: [{ old_string: 'q', new_string: '' }] }),
    ]);
    expect(changes.map((c) => [c.path, c.kind, c.added, c.removed, c.parts.length])).toEqual([
      ['C:/p/a.ts', 'edited', 2, 1, 2],
      ['C:/p/b.ts', 'edited', 0, 1, 1],
    ]);
  });

  it('Write : fichier créé, contenu gardé pour l’aperçu', () => {
    const [c] = fileChanges([tool('Write', { file_path: 'C:/p/page.html', content: '<h1>Hi</h1>' })]);
    expect(c).toMatchObject({ kind: 'created', added: 1, removed: 0, content: '<h1>Hi</h1>' });
  });

  it('Edit après Write : rejoué sur le contenu (aperçu à jour)', () => {
    const [c] = fileChanges([
      tool('Write', { file_path: 'p.html', content: '<p>a</p><p>a</p>' }),
      tool('Edit', { file_path: 'p.html', old_string: 'a', new_string: 'b', replace_all: true }),
      tool('MultiEdit', { file_path: 'p.html', edits: [{ old_string: '<p>b</p>', new_string: '<h1>t</h1>' }] }),
    ]);
    expect(c.content).toBe('<h1>t</h1><p>b</p>');
  });

  it('Write après des Edit : repart de zéro ; Edit introuvable après Write : contenu complet inconnu', () => {
    const [c] = fileChanges([
      tool('Edit', { file_path: 'a', old_string: 'x', new_string: 'y' }),
      tool('Write', { file_path: 'a', content: 'n' }),
      tool('Edit', { file_path: 'a', old_string: 'zz', new_string: 'm' }),
    ]);
    expect(c).toMatchObject({ kind: 'created', added: 2, removed: 1, content: undefined });
  });

  it('ignore ce qui ne modifie pas de fichier', () => {
    expect(fileChanges([tool('Bash', { command: 'ls' }), { kind: 'assistant', text: 'ok' }])).toEqual([]);
  });
});

describe('turnRanges', () => {
  it('une plage par message de l’utilisateur', () => {
    const items: ChatItem[] = [
      { kind: 'user', text: 'a' },
      { kind: 'assistant', text: 'b' },
      { kind: 'user', text: 'c' },
      { kind: 'tool', name: 'Edit', input: {} },
    ];
    expect(turnRanges(items)).toEqual([[0, 2], [2, 4]]);
  });

  it('historique qui ne commence pas par l’utilisateur', () => {
    expect(turnRanges([{ kind: 'assistant', text: 'x' }])).toEqual([[0, 1]]);
  });
});

describe('withContext', () => {
  it('replie les lignes inchangées loin des changements', () => {
    const same = (t: string) => ({ type: 'same' as const, text: t });
    const lines = [same('1'), same('2'), same('3'), same('4'), { type: 'add' as const, text: 'x' }, same('5')];
    expect(withContext(lines, 1)).toEqual([{ type: 'gap', count: 3 }, same('4'), { type: 'add', text: 'x' }, same('5')]);
  });
});
