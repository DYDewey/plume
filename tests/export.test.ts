import { describe, expect, it } from 'vitest';
import { cleanFileName, exportFileName, toMarkdown } from '../src/shared/export';

describe('toMarkdown', () => {
  it('messages, outils groupés, erreurs', () => {
    const md = toMarkdown('Promesses', [
      { kind: 'user', text: 'Explique' },
      { kind: 'tool', name: 'Read', input: { file_path: 'a.js' } },
      { kind: 'tool', name: 'Bash', input: { command: 'echo `x`' } },
      { kind: 'assistant', text: 'Une **promesse**…' },
      { kind: 'error', message: 'Coupé' },
    ], new Date(2026, 10, 10));
    expect(md).toBe(
      '# Promesses\n\n*Exporté de Mon-Claude le 10/11/2026*\n\n## Toi\n\nExplique\n\n- *Read* `a.js`\n- *Bash* `echo \'x\'`\n\n## Claude\n\nUne **promesse**…\n\n> Erreur : Coupé\n',
    );
  });
});

describe('exportFileName', () => {
  it('retire les caractères interdits par Windows', () => {
    expect(exportFileName('Refonte : UI / menu?', 'pdf')).toBe('Refonte UI menu.pdf');
    expect(exportFileName('', 'md')).toBe('conversation.md');
  });
});

describe('cleanFileName', () => {
  it('remplace barres obliques inverses et caractères de contrôle', () => {
    expect(cleanFileName('a' + String.fromCharCode(92) + 'b' + String.fromCharCode(7) + 'c')).toBe('a b c');
  });
});
