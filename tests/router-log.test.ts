import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { lastResponder } from '../src/main/router-log';
import { bareModel } from '../src/shared/model';

function fakeLog(rows: Array<{ session: string; provider: string; response: string; resolved?: string; ok?: number }>) {
  const path = join(mkdtempSync(join(tmpdir(), 'ccr-log-')), 'request-logs.sqlite');
  const db = new DatabaseSync(path);
  db.exec('create table request_logs (id integer primary key autoincrement, provider text, response_model text, resolved_model text, ok integer, request_headers text)');
  const insert = db.prepare('insert into request_logs (provider, response_model, resolved_model, ok, request_headers) values (?, ?, ?, ?, ?)');
  for (const r of rows) insert.run(r.provider, r.response, r.resolved ?? r.response, r.ok ?? 1, JSON.stringify({ 'x-claude-code-session-id': r.session }));
  db.close();
  return path;
}

describe('lastResponder', () => {
  it('renvoie la dernière réponse réussie de la session', () => {
    const path = fakeLog([
      { session: 'aaa', provider: 'Claude Code API', response: 'claude-sonnet-5-5' },
      { session: 'aaa', provider: 'Google Gemini', response: 'gemini-3.5-flash' },
      { session: 'aaa', provider: 'Google Gemini', response: 'gemini-3.8-flash', ok: 0 },
      { session: 'bbb', provider: 'Claude Code API', response: 'claude-opus-5-5' },
    ]);
    expect(lastResponder(path, 'aaa')).toEqual({ provider: 'Google Gemini', model: 'gemini-3.5-flash' });
    expect(lastResponder(path, 'bbb')).toEqual({ provider: 'Claude Code API', model: 'claude-opus-5-5' });
  });

  it('enlève le préfixe que ccr ajoute parfois', () => {
    const path = fakeLog([{ session: 'aaa', provider: 'Claude Code API', response: 'Claude Code API/claude-sonnet-5-5' }]);
    expect(lastResponder(path, 'aaa')?.model).toBe('claude-sonnet-5-5');
  });

  it('prend resolved_model si le fournisseur n\'a pas renvoyé de nom', () => {
    const path = fakeLog([{ session: 'aaa', provider: 'Google Gemini', response: '', resolved: 'gemini-3.7-flash' }]);
    expect(lastResponder(path, 'aaa')?.model).toBe('gemini-3.7-flash');
  });

  it('renvoie null pour une session inconnue ou un journal absent', () => {
    expect(lastResponder(fakeLog([]), 'zzz')).toBeNull();
    expect(lastResponder(join(tmpdir(), 'nexiste-pas', 'x.sqlite'), 'zzz')).toBeNull();
  });
});

describe('bareModel', () => {
  it('enlève le préfixe du fournisseur ccr', () => {
    expect(bareModel('Claude Code API/claude-sonnet-5-5')).toBe('claude-sonnet-5-5');
    expect(bareModel('claude-opus-5-5')).toBe('claude-opus-5-5');
  });
});
