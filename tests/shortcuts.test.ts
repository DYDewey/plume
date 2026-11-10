import { describe, expect, it } from 'vitest';
import { isCtrlLetter, neighborSession, tabDirection } from '../src/renderer/src/ui-format';

const key = (k: string, mods: Partial<Record<'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey', boolean>> = {}) => ({
  key: k, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...mods,
});

describe('raccourcis', () => {
  it('Ctrl+N et Ctrl+K, majuscule comprise, mais pas avec Maj', () => {
    expect(isCtrlLetter(key('n', { ctrlKey: true }), 'n')).toBe(true);
    expect(isCtrlLetter(key('K', { ctrlKey: true }), 'k')).toBe(true);
    expect(isCtrlLetter(key('n', { ctrlKey: true, shiftKey: true }), 'n')).toBe(false);
    expect(isCtrlLetter(key('n'), 'n')).toBe(false);
  });

  it('Ctrl+Tab avance, Ctrl+Maj+Tab recule, Tab seul ne fait rien', () => {
    expect(tabDirection(key('Tab', { ctrlKey: true }))).toBe(1);
    expect(tabDirection(key('Tab', { ctrlKey: true, shiftKey: true }))).toBe(-1);
    expect(tabDirection(key('Tab'))).toBe(0);
  });
});

describe('neighborSession', () => {
  it('boucle dans les deux sens', () => {
    expect(neighborSession(['a', 'b', 'c'], 'c', 1)).toBe('a');
    expect(neighborSession(['a', 'b', 'c'], 'a', -1)).toBe('c');
  });

  it('sans session affichée : la première ou la dernière', () => {
    expect(neighborSession(['a', 'b'], null, 1)).toBe('a');
    expect(neighborSession(['a', 'b'], null, -1)).toBe('b');
  });

  it('rien à changer avec une seule session ou aucune', () => {
    expect(neighborSession(['a'], 'a', 1)).toBeNull();
    expect(neighborSession([], null, 1)).toBeNull();
  });
});
