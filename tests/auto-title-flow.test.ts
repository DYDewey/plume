import { describe, expect, it } from 'vitest';
import { initialTrack, titleRequest } from '../src/renderer/src/auto-title-flow';
import type { ChatItem } from '../src/shared/chat-item';

const items: ChatItem[] = [
  { kind: 'user', text: 'Refais l’UI de mon app' },
  { kind: 'tool', name: 'Read', input: {} },
  { kind: 'assistant', text: 'Je commence par…' },
];
const idle = { status: 'idle' as const, items };

describe('titleRequest', () => {
  it('demande un titre après la 1re réponse complète', () => {
    expect(titleRequest(idle, undefined, false)).toEqual({ userTexts: ['Refais l’UI de mon app'], lastReply: 'Je commence par…', userCount: 1 });
  });

  it('jamais pendant une réponse, ni après un renommage, ni une fois trouvé', () => {
    expect(titleRequest({ ...idle, status: 'running' }, undefined, false)).toBeNull();
    expect(titleRequest(idle, undefined, true)).toBeNull();
    expect(titleRequest(idle, { tries: 1, userCount: 0, done: true }, false)).toBeNull();
  });

  it('« AUCUN » au 1er tour : redemande seulement après un nouveau message, 3 fois au plus', () => {
    expect(titleRequest(idle, { tries: 1, userCount: 1, done: false }, false)).toBeNull();
    const two = { status: 'idle' as const, items: [...items, { kind: 'user' as const, text: 'et la sidebar' }, { kind: 'assistant' as const, text: 'ok' }] };
    expect(titleRequest(two, { tries: 1, userCount: 1, done: false }, false)?.userCount).toBe(2);
    expect(titleRequest(two, { tries: 3, userCount: 1, done: false }, false)).toBeNull();
  });

  it('conversation continuée : pas de titre avant un nouveau message', () => {
    const start = initialTrack(items);
    expect(titleRequest(idle, start, false)).toBeNull();
    const more = { status: 'idle' as const, items: [...items, { kind: 'user' as const, text: 'suite' }, { kind: 'assistant' as const, text: 'ok' }] };
    expect(titleRequest(more, start, false)?.userCount).toBe(2);
    expect(initialTrack([]).userCount).toBe(0);
  });

  it('ignore les commandes « / » et attend une vraie réponse', () => {
    expect(titleRequest({ status: 'idle', items: [{ kind: 'user', text: '/clear' }, { kind: 'assistant', text: 'ok' }] }, undefined, false)).toBeNull();
    expect(titleRequest({ status: 'idle', items: [{ kind: 'user', text: 'salut' }, { kind: 'error', message: 'x' }] }, undefined, false)).toBeNull();
  });
});
