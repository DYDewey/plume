import { describe, expect, it } from 'vitest';
import { addPrompt, filterPrompts, parsePrompts, promptTitle, removePrompt } from '../src/shared/prompts';

describe('prompts', () => {
  it('titre : 1re ligne non vide, coupée', () => {
    expect(promptTitle('\n  Relis mon code\nen détail')).toBe('Relis mon code');
    expect([...promptTitle('x'.repeat(100))]).toHaveLength(48);
    expect(promptTitle('   ')).toBe('Sans titre');
  });

  it('ajout en tête, sans doublon ; texte vide ignoré', () => {
    let list = addPrompt([], 'A', '1');
    list = addPrompt(list, 'B', '2');
    list = addPrompt(list, ' A ', '3');
    expect(list.map((p) => [p.id, p.text])).toEqual([['3', 'A'], ['2', 'B']]);
    expect(addPrompt(list, '  ', '4')).toBe(list);
    expect(removePrompt(list, '2').map((p) => p.id)).toEqual(['3']);
  });

  it('lecture tolérante', () => {
    expect(parsePrompts(null)).toEqual([]);
    expect(parsePrompts('{cassé')).toEqual([]);
    expect(parsePrompts('[{"id":"1","title":"t","text":"x"},{"id":2}]')).toEqual([{ id: '1', title: 't', text: 'x' }]);
  });

  it('filtre sur tous les mots', () => {
    const list = [{ title: 'Relecture', text: 'relis le code' }, { title: 'Plan', text: 'découpe en tâches' }];
    expect(filterPrompts(list, 'CODE rel')).toEqual([list[0]]);
    expect(filterPrompts(list, '')).toEqual(list);
  });
});
