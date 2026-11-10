import { describe, expect, it } from 'vitest';
import { notificationBody } from '../src/shared/notify';

describe('notificationBody', () => {
  it('retire la mise en forme et remplace le code', () => {
    expect(notificationBody('## Fini\n**Tout** passe : voir [le test](a.ts)\n```ts\nx\n```')).toBe('Fini Tout passe : voir le test [code]');
  });

  it('coupe les longues réponses', () => {
    const body = notificationBody('a'.repeat(300));
    expect([...body]).toHaveLength(140);
    expect(body.endsWith('…')).toBe(true);
  });

  it('texte par défaut sans réponse', () => {
    expect(notificationBody(undefined)).toBe('La réponse est prête.');
  });
});
