import { describe, expect, it } from 'vitest';
import { createArtifactStore } from '../src/main/artifact-store';

describe('artifact-store', () => {
  it('rend la page de son adresse, rien pour une adresse inconnue', () => {
    const store = createArtifactStore();
    const url = store.put('<p>a</p>');
    expect(url).toMatch(/^artifact:\/\/view\//);
    expect(store.get(url)).toBe('<p>a</p>');
    expect(store.get('artifact://view/../../etc')).toBeUndefined();
  });

  it('oublie les plus anciennes au-delà du plafond', () => {
    const store = createArtifactStore(2);
    const first = store.put('1');
    store.put('2');
    store.put('3');
    expect(store.get(first)).toBeUndefined();
  });
});
