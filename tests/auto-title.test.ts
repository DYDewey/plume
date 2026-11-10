import { describe, expect, it } from 'vitest';
import { claudeFolder, cleanTitle, titleExcerpt } from '../src/shared/auto-title';
import { askTitle } from '../src/main/judge';

describe('cleanTitle', () => {
  it('garde un titre propre', () => {
    expect(cleanTitle('Écran paramètres de Mon-Claude')).toBe('Écran paramètres de Mon-Claude');
  });
  it('retire guillemets, préfixe et point final', () => {
    expect(cleanTitle('« Bug de connexion NFC ».')).toBe('Bug de connexion NFC');
    expect(cleanTitle('Titre : "Refonte UI"\n')).toBe('Refonte UI');
    expect(cleanTitle('**Appli trajets train**')).toBe('Appli trajets train');
  });
  it('AUCUN ou vide : pas de titre', () => {
    expect(cleanTitle('AUCUN')).toBeNull();
    expect(cleanTitle('  aucun.  ')).toBeNull();
    expect(cleanTitle('')).toBeNull();
  });
  it('coupe un titre trop long', () => {
    expect([...(cleanTitle('mot '.repeat(30)) ?? '')].length).toBeLessThanOrEqual(60);
  });
});

describe('titleExcerpt', () => {
  it('au plus 3 messages, textes raccourcis', () => {
    const ex = titleExcerpt(['a', 'b', 'c', 'd'], 'x'.repeat(2000));
    expect(ex).toContain('Message 3');
    expect(ex).not.toContain('Message 4');
    expect(ex.length).toBeLessThan(900);
  });
});

describe('claudeFolder', () => {
  it('encode le chemin comme Claude Code', () => {
    expect(claudeFolder('C:\\Users\\moi\\Documents\\mon-claude')).toBe('C--Users-moi-Documents-mon-claude');
    expect(claudeFolder('C:\\Users\\moi\\.claude-mem')).toBe('C--Users-moi--claude-mem');
  });
});

describe('askTitle', () => {
  const reply = (body: unknown, ok = true) => (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;
  it('sans passerelle : null, aucun appel', async () => {
    expect(await askTitle('x', { token: null, fetch: () => { throw new Error('appel'); } })).toBeNull();
  });
  it('renvoie le titre nettoyé', async () => {
    expect(await askTitle('x', { token: 't', fetch: reply({ model: 'gemini', content: [{ type: 'text', text: '« Refonte UI »' }] }) })).toBe('Refonte UI');
  });
  it('AUCUN, erreur HTTP ou réponse Claude : null', async () => {
    expect(await askTitle('x', { token: 't', fetch: reply({ content: [{ type: 'text', text: 'AUCUN' }] }) })).toBeNull();
    expect(await askTitle('x', { token: 't', fetch: reply({}, false) })).toBeNull();
    expect(await askTitle('x', { token: 't', fetch: reply({ model: 'claude-x', content: [{ type: 'text', text: 'Titre' }] }) })).toBeNull();
  });
});
