import { describe, expect, it } from 'vitest';
import { decideRoute, isContinuation, ruleRoute } from '../src/shared/auto-route';

// Les 5 décisions du journal %APPDATA%/mon-claude/auto-route.jsonl (09/11/2026), avec l'avis du juge enregistré.
const route = (text: string, judge: 'haiku' | 'sonnet' | 'opus', current?: 'haiku' | 'sonnet' | 'opus') =>
  decideRoute(text, ruleRoute(text), judge, { current }).model;

describe('journal Auto du 09/11', () => {
  it('« bonjour comment tu vas ? » : Haiku', () => {
    expect(route('bonjour comment tu vas ?', 'haiku', 'sonnet')).toBe('haiku');
  });

  it('début de projet : Sonnet minimum, même si le juge dit Haiku', () => {
    expect(route("J'aimerais qu'on travail ensemble sur un projet", 'haiku', 'haiku')).toBe('sonnet');
    expect(route("Projet Lichii j'aime beaucoup en ce moment", 'haiku', 'haiku')).toBe('sonnet');
  });

  it('lien GitHub avec du code : Opus', () => {
    expect(route('https://github.com/zortos293/Lichii/releases/tag/build-130 voila un nouveau build, regarde le code', 'opus', 'sonnet')).toBe('opus');
  });

  it('« Vas-y prépare tout… » garde le modèle de la tâche, sans regarder le juge', () => {
    expect(route('Vas-y prépare tout pour que je puisse le teste après', 'haiku', 'opus')).toBe('opus');
    expect(decideRoute('vas-y', ruleRoute('vas-y'), 'opus', { current: 'sonnet' })).toMatchObject({ model: 'sonnet', source: 'gardé' });
  });
});

describe('isContinuation', () => {
  it('reconnaît les relances courtes', () => {
    for (const t of ['vas-y', 'Oui vas-y', 'ok continue', 'fais-le', 'Go', 'oui', "c'est parti !", 'je te laisse faire', 'enchaîne la phase 2']) {
      expect(isContinuation(t), t).toBe(true);
    }
  });

  it('pas une vraie nouvelle demande', () => {
    for (const t of ['merci beaucoup', 'explique-moi les promesses', 'vas voir le fichier ' + 'x'.repeat(150), 'non']) {
      expect(isContinuation(t), t).toBe(false);
    }
  });

  it('sans modèle en cours (1er message) : décision normale', () => {
    expect(decideRoute('vas-y', ruleRoute('vas-y'), 'haiku').source).not.toBe('gardé');
  });
});
