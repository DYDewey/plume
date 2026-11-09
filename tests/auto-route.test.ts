import { describe, expect, it } from 'vitest';
import { decideRoute, judgeExcerpt, parseJudge, ruleRoute, STICKY_CONTEXT } from '../src/shared/auto-route';

const model = (text: string) => ruleRoute(text).model;

describe('règles', () => {
  it.each([
    'salut ça va',
    'merci !',
    'ok cool',
    "c'est quoi un pangolin ?",
    'traduis "bonjour" en espagnol',
    'quelle est la capitale du Pérou',
    '12*37+4',
    'combien de jours en février 2028',
    'synonyme de rapide',
  ])('Haiku : %s', (text) => expect(model(text)).toBe('haiku'));

  it.each([
    'explique-moi la photosynthèse',
    'pourquoi le ciel est bleu',
    'rédige un mail à mon prof pour décaler mon oral',
    'que penses-tu de mon idée de stage à Lille ?',
    "salut, explique-moi comment marche l'inflation",
    'quels sont les avantages et inconvénients du nucléaire',
    "j'aimerais bien comprendre un peu mieux ce qui s'est passé pendant la révolution industrielle en Angleterre",
  ])('Sonnet : %s', (text) => expect(model(text)).toBe('sonnet'));

  it.each([
    'corrige le bug dans app.tsx',
    "```ts\nconst a = 1\n```\nça marche pas",
    'TypeError: cannot read properties of undefined',
    'crée une appli Android pour mes horaires de train',
    'implémente le mode auto dans mon-claude',
    'refactor this function and add unit tests',
    'regarde C:\\Users\\moi\\projet et dis-moi ce qui cloche',
    'git push me met une erreur, comment je fais ?',
    "l'appli plante au démarrage",
    'npm ERR! code ERESOLVE',
  ])('Opus sûr : %s', (text) => {
    expect(ruleRoute(text)).toMatchObject({ model: 'opus', sure: true });
  });

  it('pas de faux code : code postal, une plante, une adresse web, la ligne de bus', () => {
    expect(model('quel est le code postal de Calais')).not.toBe('opus');
    expect(model('ma plante a des feuilles jaunes, pourquoi ?')).toBe('sonnet');
    expect(model('résume cet article https://exemple.fr/actu')).not.toBe('opus');
    expect(model('à quelle heure passe la ligne 3 du bus')).not.toBe('opus');
  });

  it.each([
    'wesh',
    'mdr',
    'bonne nuit',
    'que signifie FOMO',
    'conjugue aller au subjonctif',
    'combien font 15% de 80',
    '10 km en miles',
    'raconte une blague',
    'pile ou face',
    'quelle est la population du Japon',
  ])('Haiku (mots ajoutés) : %s', (text) => expect(model(text)).toBe('haiku'));

  it.each([
    'fais-moi un QCM sur la Seconde Guerre mondiale',
    'prépare mon oral de soutenance',
    'propose-moi un programme de musculation',
    "donne-moi une recette avec des pâtes et du thon",
    'écris-moi une lettre de motivation pour une alternance',
    'je comprends pas la différence entre ADN et ARN',
    'how does photosynthesis work',
  ])('Sonnet (mots ajoutés) : %s', (text) => expect(model(text)).toBe('sonnet'));

  it.each([
    'mon useEffect tourne en boucle',
    'comment faire un commit sur github',
    'ModuleNotFoundError: No module named requests',
    'écris un script powershell pour renommer mes photos',
    'quelle différence entre let et var en javascript',
    'mon programme en C++ fait un segfault',
    'crée un bot discord',
    'requête SQL pour compter les clients par ville',
    "l'émulateur freeze à cause des shaders",
  ])('Opus sûr (mots ajoutés) : %s', (text) => {
    expect(ruleRoute(text)).toMatchObject({ model: 'opus', sure: true });
  });

  it.each([
    'calcule le masque de sous-réseau pour 50 hôtes',
    'démontre par récurrence que 2^n > n',
    'configure un VLAN sur un switch Cisco',
    'mon wifi ne fonctionne plus sur Windows',
  ])('Opus probable (le juge peut corriger) : %s', (text) => {
    expect(ruleRoute(text)).toMatchObject({ model: 'opus', sure: false });
  });

  it('tâche complexe ou très long message → Opus, sans être sûr', () => {
    expect(ruleRoute('fais une analyse en profondeur du marché des VTC')).toMatchObject({ model: 'opus', sure: false });
    expect(ruleRoute('blabla '.repeat(300))).toMatchObject({ model: 'opus', sure: false });
  });
});

describe('réponse du juge', () => {
  it('lit un mot, même avec majuscule ou ponctuation', () => {
    expect(parseJudge('Opus.')).toBe('opus');
    expect(parseJudge(' haiku\n')).toBe('haiku');
  });

  it('illisible ou ambiguë → null', () => {
    expect(parseJudge('je ne sais pas')).toBeNull();
    expect(parseJudge('sonnet ou opus')).toBeNull();
  });

  it('extrait début et fin d’un long message', () => {
    const long = 'a'.repeat(3000) + 'FIN';
    const ex = judgeExcerpt(long);
    expect(ex.length).toBeLessThan(2600);
    expect(ex.endsWith('FIN')).toBe(true);
    expect(judgeExcerpt('court')).toBe('court');
  });
});

describe('décision', () => {
  const sureOpus = { model: 'opus' as const, sure: true, reason: 'code collé' };
  const guessSonnet = { model: 'sonnet' as const, sure: false, reason: 'explication' };

  it('le juge l’emporte sur une règle incertaine', () => {
    expect(decideRoute('x', guessSonnet, 'haiku')).toMatchObject({ model: 'haiku', source: 'juge' });
    expect(decideRoute('x', guessSonnet, 'opus')).toMatchObject({ model: 'opus', source: 'juge' });
  });

  it('le juge ne descend jamais sous une règle sûre', () => {
    expect(decideRoute('x', sureOpus, 'haiku')).toMatchObject({ model: 'opus', source: 'règles' });
  });

  it('sans juge, les règles décident', () => {
    expect(decideRoute('x', guessSonnet, null)).toMatchObject({ model: 'sonnet', source: 'règles' });
  });

  it('commande « / » : modèle en cours gardé', () => {
    expect(decideRoute('/garde-contexte', guessSonnet, 'haiku', { current: 'opus' })).toMatchObject({ model: 'opus', source: 'gardé' });
    expect(decideRoute('/clear', guessSonnet, null)).toMatchObject({ model: 'sonnet' });
  });

  it('conversation longue : on ne descend plus, on peut monter', () => {
    const long = { current: 'opus' as const, contextUsed: STICKY_CONTEXT + 1 };
    expect(decideRoute('x', guessSonnet, 'haiku', long)).toMatchObject({ model: 'opus', source: 'gardé' });
    expect(decideRoute('x', guessSonnet, 'haiku', { current: 'opus', contextUsed: 1000 })).toMatchObject({ model: 'haiku' });
    expect(decideRoute('x', sureOpus, 'opus', { current: 'haiku', contextUsed: 99_999 })).toMatchObject({ model: 'opus' });
  });
});
