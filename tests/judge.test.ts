import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { askJudge, JUDGE_MODEL, logRoute } from '../src/main/judge';

const reply = (body: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => body }) as Response);

describe('juge', () => {
  it('envoie le message à Gemini via la passerelle et lit le mot', async () => {
    const fetch = reply({ model: 'gemini-3.5-flash-lite', content: [{ type: 'text', text: 'Opus' }] });
    expect(await askJudge('corrige mon code', { token: 't', fetch })).toBe('opus');
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:3456/v1/messages');
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe(JUDGE_MODEL);
    expect(body.messages[0].content).toContain('corrige mon code');
  });

  it('sans jeton : pas d’appel, null', async () => {
    const fetch = reply({});
    expect(await askJudge('x', { token: null, fetch })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('erreur HTTP, réseau, réponse illisible ou modèle Claude → null', async () => {
    expect(await askJudge('x', { token: 't', fetch: reply({}, false) })).toBeNull();
    expect(await askJudge('x', { token: 't', fetch: vi.fn(async () => { throw new Error('ECONNREFUSED'); }) })).toBeNull();
    expect(await askJudge('x', { token: 't', fetch: reply({ content: [{ type: 'text', text: '???' }] }) })).toBeNull();
    expect(await askJudge('x', { token: 't', fetch: reply({ model: 'claude-haiku-5-5', content: [{ type: 'text', text: 'haiku' }] }) })).toBeNull();
  });
});

describe('journal des choix', () => {
  it('ajoute une ligne JSON avec le début du message seulement', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'route-')), 'auto-route.jsonl');
    const rule = { model: 'sonnet' as const, sure: false, reason: 'explication' };
    await logRoute(path, 'z'.repeat(200), rule, 'haiku', { model: 'haiku', reason: 'avis du juge', source: 'juge' });
    const line = JSON.parse(readFileSync(path, 'utf8').trim());
    expect(line.debut).toHaveLength(80);
    expect(line.choix.model).toBe('haiku');
  });
});
