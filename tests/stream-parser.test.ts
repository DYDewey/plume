import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createStreamParser } from '../src/main/stream-parser';

const fixture = readFileSync(join(__dirname, 'fixtures/stream-bonjour.jsonl'), 'utf8');

describe('createStreamParser', () => {
  it('transforme le vrai flux en text-delta puis turn-end', () => {
    const parser = createStreamParser('s1');
    const events = parser.push(fixture);

    expect(events.map((e) => e.type)).toEqual(['commands', 'model', 'text-delta', 'checkpoint', 'rate-limits', 'context', 'turn-end']);
    expect(events[2]).toEqual({ type: 'text-delta', sessionId: 's1', text: 'bonjour' });
    expect(events[3]).toMatchObject({ type: 'checkpoint', sessionId: 's1' });
    expect(events[6]).toMatchObject({ type: 'turn-end', sessionId: 's1', result: 'bonjour' });
  });

  it('rate_limit_event donne les jauges 5 h et 7 jours', () => {
    const limits = createStreamParser('s1').push(fixture).find((e) => e.type === 'rate-limits');
    expect(limits).toEqual({
      type: 'rate-limits',
      sessionId: 's1',
      fiveHour: { utilization: 0.04, resetsAt: 1792860000 },
      sevenDay: { utilization: 0.5, resetsAt: 1793116800 },
    });
  });

  it('result donne le contexte : tokens du dernier message / contextWindow du modèle', () => {
    const context = createStreamParser('s1').push(fixture).find((e) => e.type === 'context');
    // 2 + 14410 + 18203 + 5 tokens dans le dernier message assistant de la fixture.
    expect(context).toEqual({ type: 'context', sessionId: 's1', used: 32620, max: 1000000 });
  });

  it('prompt_suggestion donne une suggestion de prochain message', () => {
    const line = JSON.stringify({ type: 'prompt_suggestion', suggestion: 'écris le script maintenant', uuid: 'u', session_id: 'x' });
    expect(createStreamParser('s1').push(line + '\n')).toEqual([
      { type: 'suggestion', sessionId: 's1', text: 'écris le script maintenant' },
    ]);
  });

  it('le message init donne le modèle réellement utilisé', () => {
    const events = createStreamParser('s1').push(fixture);
    expect(events.find((e) => e.type === 'model')).toEqual({ type: 'model', sessionId: 's1', model: 'claude-opus-5-5' });
  });

  it('le message init donne la liste des commandes et skills', () => {
    const [commands] = createStreamParser('s1').push(fixture);
    expect(commands.type).toBe('commands');
    const names = (commands as { names: string[] }).names;
    expect(names).toContain('aide-decision');
    expect(names).toContain('anthropic-skills:passation');
  });

  it('recolle une ligne coupée en plusieurs morceaux', () => {
    const parser = createStreamParser('s1');
    const line = fixture.split('\n').find((l) => l.includes('"text_delta"'))! + '\n';
    const cut = Math.floor(line.length / 2);

    expect(parser.push(line.slice(0, cut))).toEqual([]);
    expect(parser.push(line.slice(cut))).toEqual([
      { type: 'text-delta', sessionId: 's1', text: 'bonjour' },
    ]);
  });

  it('transforme un bloc tool_use d\'un message assistant en tool-use', () => {
    const parser = createStreamParser('s1');
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'toolu_1', name: 'Read', input: { file_path: 'src/app.tsx' } }],
      },
    });

    expect(parser.push(line + '\n')).toEqual([
      { type: 'tool-use', sessionId: 's1', name: 'Read', input: { file_path: 'src/app.tsx' } },
    ]);
  });

  it('ignore les lignes invalides et les types inconnus', () => {
    const parser = createStreamParser('s1');
    const events = parser.push('pas du json\n{"type":"truc_inconnu"}\n\r\n');
    expect(events).toEqual([]);
  });

  it('gère les fins de ligne Windows', () => {
    const parser = createStreamParser('s1');
    const crlf = fixture.split('\n').join('\r\n');
    expect(parser.push(crlf).map((e) => e.type)).toEqual(['commands', 'model', 'text-delta', 'checkpoint', 'rate-limits', 'context', 'turn-end']);
  });

  it('émet une erreur puis turn-end quand le résultat est en échec', () => {
    const parser = createStreamParser('s1');
    const line = JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true, result: 'boom' });
    expect(parser.push(line + '\n')).toEqual([
      { type: 'error', sessionId: 's1', message: 'boom' },
      { type: 'turn-end', sessionId: 's1', result: 'boom' },
    ]);
  });
});

describe('contexte en direct', () => {
  it('après une 1re réponse, chaque appel au modèle met le % à jour sans attendre la fin', () => {
    const parser = createStreamParser('s1');
    parser.push(fixture); // 1re réponse : la taille max (1 000 000) est apprise au result
    const start = JSON.stringify({
      type: 'stream_event',
      event: { type: 'message_start', message: { usage: { input_tokens: 10, cache_read_input_tokens: 40000, cache_creation_input_tokens: 500, output_tokens: 1 } } },
    });
    expect(parser.push(start + '\n')).toEqual([{ type: 'context', sessionId: 's1', used: 40511, max: 1000000 }]);
  });

  it('avant toute réponse : pas de % (taille max inconnue)', () => {
    const start = JSON.stringify({ type: 'stream_event', event: { type: 'message_start', message: { usage: { input_tokens: 10 } } } });
    expect(createStreamParser('s1').push(start + '\n')).toEqual([]);
  });
});
