import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSession } from '../src/main/history-parser';

const lines = readFileSync(join(__dirname, 'fixtures/history/sample.jsonl'), 'utf8').split('\n');

describe('parseSession', () => {
  it('garde messages et outils, ignore le reste et les lignes cassées', () => {
    // toEqual ignore les champs undefined : uuid est vérifié à part.
    expect(parseSession(lines).items.map((i) => ({ ...i, uuid: undefined }))).toEqual([
      { kind: 'user', text: "Explique-moi les promesses en JavaScript, avec un exemple simple s'il te plaît" },
      { kind: 'assistant', text: 'Une promesse représente une valeur future.' },
      { kind: 'tool', name: 'Read', input: { file_path: 'C:\\Users\\moi\\projet\\a.js' } },
      { kind: 'user', text: '/clear' },
      { kind: 'user', text: 'Merci !' },
    ]);
  });

  it('donne cwd, date de la dernière ligne datée et nombre de messages', () => {
    const s = parseSession(lines);
    expect(s.cwd).toBe('C:\\Users\\moi\\projet');
    expect(s.lastAt).toBe(Date.parse('2026-10-20T10:06:00.000Z'));
    expect(s.messageCount).toBe(4);
  });

  it('titre : custom-title avant ai-title', () => {
    const extra = '{"type":"custom-title","customTitle":"Mon titre","sessionId":"s1"}';
    expect(parseSession([...lines, extra]).title).toBe('Mon titre');
    expect(parseSession(lines).title).toBe('Promesses JavaScript');
  });

  it('titre : sinon le 1er vrai message, tronqué à 60 caractères', () => {
    const sansTitre = lines.filter((l) => !l.includes('ai-title'));
    const title = parseSession(sansTitre).title;
    expect(title).toBe('Explique-moi les promesses en JavaScript, avec un exemple s…');
    expect([...title]).toHaveLength(60);
  });

  it('commande « ! » : affichée comme tapée, sortie brute masquée, jamais prise comme titre', () => {
    const u = (content: string) => JSON.stringify({ type: 'user', message: { role: 'user', content } });
    const s = parseSession([
      u('<bash-input>ls -la</bash-input>'),
      u('<bash-stdout>fichier.txt</bash-stdout><bash-stderr></bash-stderr>'),
      u('Range ce dossier'),
    ]);
    expect(s.items).toEqual([{ kind: 'user', text: '! ls -la' }, { kind: 'user', text: 'Range ce dossier' }]);
    expect(s.title).toBe('Range ce dossier');
  });

  it('titre : « Sans titre » si aucun message', () => {
    expect(parseSession(['{"type":"mode"}', '']).title).toBe('Sans titre');
  });
});

describe('points de reprise', () => {
  it('chaque message de Claude garde l’uuid de sa ligne', () => {
    const items = parseSession(lines).items.filter((i) => i.kind === 'assistant' || i.kind === 'tool');
    expect(items.every((i) => 'uuid' in i && typeof i.uuid === 'string')).toBe(true);
  });
});
