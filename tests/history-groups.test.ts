import { describe, expect, it } from 'vitest';
import { groupByDate, isTechnicalProject, shortWhen } from '../src/renderer/src/history-groups';
import type { HistoryProject } from '../src/shared/history';

// 9 nov. 2026, 15 h (heure locale)
const now = new Date(2026, 10, 9, 15, 0).getTime();
const at = (d: number, h = 12) => new Date(2026, 10, d, h, 0).getTime();
const s = (id: string, lastAt: number) => ({ id, title: id, lastAt, messageCount: 2 });

describe('isTechnicalProject', () => {
  it('reconnaît les sessions de claude-mem', () => {
    expect(isTechnicalProject({ folder: 'C--Users-moi--claude-mem-observer-sessions' })).toBe(true);
    expect(isTechnicalProject({ folder: 'x', path: 'C:\\Users\\moi\\.claude-mem\\observer' })).toBe(true);
  });
  it('reconnaît les essais dans les dossiers temporaires', () => {
    expect(isTechnicalProject({ folder: 'C--Users-moi-AppData-Local-Temp-claude-x-scratchpad' })).toBe(true);
    expect(isTechnicalProject({ folder: 'x', path: 'C:\\Users\\moi\\AppData\\Local\\Temp\\essai' })).toBe(true);
  });
  it('garde les vrais projets', () => {
    expect(isTechnicalProject({ folder: 'C--Users-moi-Documents-mon-claude', path: 'C:\\Users\\moi\\Documents\\mon-claude' })).toBe(false);
  });
});

describe('groupByDate', () => {
  const projects: HistoryProject[] = [
    { folder: 'a', path: 'C:\\Users\\moi\\Documents\\mon-claude', sessions: [s('auj', at(9, 0, )), s('vieux', at(1))] },
    { folder: 'b', sessions: [s('hier-soir', at(8, 23)), s('semaine', at(3)), s('mois', at(1) - 40 * 86400000)] },
  ];

  it('range par période, plus récent d’abord, à cheval sur les projets', () => {
    const groups = groupByDate(projects, now);
    expect(groups.map((g) => [g.label, g.rows.map((r) => r.session.id)])).toEqual([
      ["Aujourd'hui", ['auj']],
      ['Hier', ['hier-soir']],
      ['7 derniers jours', ['semaine']],
      ['30 derniers jours', ['vieux']],
      ['Plus ancien', ['mois']],
    ]);
  });

  it('minuit pile compte pour aujourd’hui', () => {
    expect(groupByDate([{ folder: 'a', sessions: [s('x', at(9, 0))] }], now)[0].label).toBe("Aujourd'hui");
  });

  it('nom court du projet : dernier dossier, sinon le nom encodé', () => {
    const rows = groupByDate(projects, now).flatMap((g) => g.rows);
    expect(rows.find((r) => r.session.id === 'auj')?.project).toBe('mon-claude');
    expect(rows.find((r) => r.session.id === 'semaine')?.project).toBe('b');
  });

  it('aucun groupe vide', () => {
    expect(groupByDate([], now)).toEqual([]);
  });
});

describe('shortWhen', () => {
  it('heure pour aujourd’hui et hier, date sinon', () => {
    expect(shortWhen(at(9, 10), now)).toBe('10:00');
    expect(shortWhen(at(8, 9), now)).toBe('09:00');
    expect(shortWhen(at(3), now)).toBe('3 nov.');
  });
});
