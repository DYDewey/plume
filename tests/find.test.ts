import { describe, expect, it } from 'vitest';
import type { ChatItem } from '../src/shared/chat-item';
import { findMatches, occurrences, stepMatch } from '../src/renderer/src/find';

describe('recherche dans la conversation', () => {
  const items: ChatItem[] = [
    { kind: 'user', text: 'Explique les Promesses' },
    { kind: 'tool', name: 'Read', input: { file_path: 'promesse.js' } },
    { kind: 'assistant', text: 'Une promesse représente…' },
    { kind: 'assistant', text: 'Rien à voir' },
  ];

  it('messages seulement, casse et accents ignorés', () => {
    expect(findMatches(items, 'PROMESSE')).toEqual([0, 2]);
    expect(findMatches(items, 'represente')).toEqual([2]);
    expect(findMatches(items, '  ')).toEqual([]);
  });

  it('suivant / précédent en boucle', () => {
    expect(stepMatch(1, 2, 1)).toBe(0);
    expect(stepMatch(0, 2, -1)).toBe(1);
    expect(stepMatch(0, 0, 1)).toBe(0);
  });

  it('positions à surligner', () => {
    expect(occurrences('Été, été', 'ete')).toEqual([[0, 3], [5, 8]]);
    expect(occurrences('abc', 'z')).toEqual([]);
  });
});
