import type { ModelChoice } from './model';

/**
 * Mode « Auto » : choisir Haiku, Sonnet ou Opus selon le message (voir SPEC-auto-model.md).
 * Tout est pur ici : les règles, la lecture de la réponse du juge et la décision finale.
 */

export type ModelSetting = ModelChoice | 'auto';

export interface RuleResult {
  model: ModelChoice;
  /** Signal très net (code collé, trace d'erreur…) : le juge ne peut pas descendre en dessous. */
  sure: boolean;
  reason: string;
}

export interface Route {
  model: ModelChoice;
  reason: string;
  source: 'règles' | 'juge' | 'gardé';
}

const RANK: Record<ModelChoice, number> = { haiku: 0, sonnet: 1, opus: 2 };

/** Au-delà, changer de modèle relit tout l'historique sans cache : on ne descend plus. */
export const STICKY_CONTEXT = 40_000;

/** Minuscules sans accents : « Implémente » et « implemente » se valent. */
export function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

interface Rule {
  model: ModelChoice;
  sure: boolean;
  reason: string;
  test: RegExp;
}

// Testées sur le texte normalisé (minuscules, sans accents). L'ordre compte peu : on garde le modèle le plus fort trouvé.
const OPUS_SURE: Rule[] = [
  { model: 'opus', sure: true, reason: 'code collé', test: /```|^\s*(import|export|def|class|function|const|let|var|public|private|#include|using)\s/m },
  { model: 'opus', sure: true, reason: "trace d'erreur", test: /traceback|\bexception\b|stack ?trace|\berror:|\berreur ?:|\bat .+\(.+:\d+|\b(at|on) line \d+|a la ligne \d+|segfault|nullpointer|undefined is not|cannot read propert|typeerror|syntaxerror|referenceerror|npm err|exit code|code de sortie/ },
  { model: 'opus', sure: true, reason: 'fichier de code cité', test: /\b[\w./\\-]+\.(tsx?|jsx?|mjs|cjs|py|java|kt|kts|c|cc|cpp|h|hpp|cs|go|rs|rb|php|swift|dart|lua|sql|sh|ps1|bat|gradle|vue|svelte|html|css|scss|json|ya?ml|toml|xml|ini|ipynb)\b/ },
  { model: 'opus', sure: true, reason: 'chemin ou pièce jointe', // « http:// » n'est pas un chemin Windows : on exclut « :// ».
    test: /\b[a-z]:[\\/](?!\/)|(^|\s)\.{0,2}\/[\w.-]+\/[\w.-]+/ },
  { model: 'opus', sure: true, reason: 'travail sur du code', test: /\b(debug(gue|ger)?|implemente[rz]?|refactor(ise|iser|e)?|coder|codez|programmer|compile[rz]?|deploie[rz]?|bug|bugs|bogue|crash|plantage|commit|merge|rebase|pull request|build|lint|tests? unitaires?|typecheck)\b|\bcode\b(?! (postal|de la route|promo|pin|secret|civil|penal|vestimentaire))|\b(ca|il|elle|qui|l'appli|l'app) plante\b|\b(corrige|repare|optimise)[rz]? (le|la|les|mon|ma|mes|ce|cette|ces) (code|script|fonction|requete|appli|app|programme|erreur|bug|test|page|site)/ },
  { model: 'opus', sure: true, reason: 'création logicielle', test: /\b(cree|creer|fais|faire|ecris|ecrire|developpe|developper|ajoute|ajouter|construis|genere)\b.{0,40}\b(app|appli|application|site|page web|api|fonction|classe|script|programme|composant|module|bot|extension|plugin|serveur|base de donnees|requete|endpoint|interface|jeu|algorithme|regex)\b/ },
  { model: 'opus', sure: true, reason: 'code (anglais)', test: /\b(fix|implement|refactor|debug|write (a|the) (function|script|class|test)|unit tests?|stack trace|compile|deploy)\b/ },
  { model: 'opus', sure: true, reason: 'outils de dev', test: /\b(git|npm|npx|pip|gradle|docker|kubernetes|vite|webpack|electron|react|typescript|python|kotlin|android studio|vs ?code|powershell|bash|sql|api rest|graphql|regex)\b.{0,60}\b(marche pas|fonctionne pas|erreur|probleme|configure|installe|comment)\b/ },
];

const OPUS_GUESS: Rule[] = [
  { model: 'opus', sure: false, reason: 'tâche complexe', test: /\b(analyse (en profondeur|complete|detaillee)|architecture|plan detaille|etape par etape|strategie|audit|demontre|demonstration|preuve|optimise|compare en detail|projet complet|cahier des charges|specification)\b/ },
  { model: 'opus', sure: false, reason: 'mathématiques avancées', test: /\b(integrale|derivee|matrice|equation differentielle|probabilite conditionnelle|theoreme|limite de|suite recurrente|complexite algorithmique)\b/ },
];

const SONNET: Rule[] = [
  { model: 'sonnet', sure: false, reason: 'explication', test: /\b(explique|expliquer|pourquoi|comment (ca|fonctionne|marche|faire)|difference entre|quelle est la difference|aide[- ]moi a comprendre|cours sur|fiche de revision|resume (ce|cet|cette|le|la) (texte|cours|article|chapitre|document))\b/ },
  { model: 'sonnet', sure: false, reason: 'rédaction', test: /\b(redige|rediger|ecris (un|une|moi)|ecrire (un|une)|mail|e-mail|lettre|courrier|dissertation|lettre de motivation|cv|rapport|compte rendu|discours|post linkedin|paragraphe|introduction|conclusion)\b/ },
  { model: 'sonnet', sure: false, reason: 'conseil ou avis', test: /\b(conseil|conseille|recommande|que penses[- ]tu|ton avis|aide[- ]moi a choisir|lequel (choisir|prendre)|vaut[- ]il mieux|idees? de|brainstorm)\b/ },
  { model: 'sonnet', sure: false, reason: 'question détaillée', test: /\b(liste|compare|avantages|inconvenients|exemples?)\b/ },
];

const HAIKU: Rule[] = [
  { model: 'haiku', sure: false, reason: 'politesse', test: /^(salut|bonjour|bonsoir|coucou|hello|hey|yo|merci|thanks|ok|okay|d'accord|dac|cool|super|top|parfait|oui|non|bien|ca va|bonne nuit|a plus|bye)\b.{0,25}$/ },
  { model: 'haiku', sure: false, reason: 'définition rapide', test: /^(c'est quoi|c quoi|qu'est[- ]ce que?|que veut dire|ca veut dire quoi|definition|definis|signification|what is|what's)\b/ },
  { model: 'haiku', sure: false, reason: 'traduction ou langue', test: /\b(tradui[st]|traduction|translate|synonyme|antonyme|conjugue|orthographe|comment on dit|comment dit[- ]on|pluriel de|feminin de)\b/ },
  { model: 'haiku', sure: false, reason: 'fait simple', test: /^(combien|quand|quel(le)?s? (est|sont|age|jour|heure|annee|date|capitale|pays|taille|poids)|qui (est|a|etait)|ou (est|se trouve)|en quelle annee)\b/ },
  { model: 'haiku', sure: false, reason: 'calcul ou conversion', test: /^[\d\s.,+\-*/x×÷()%^=?]+$|\b(convertis|conversion|calcule) .{0,30}\d/ },
  { model: 'haiku', sure: false, reason: 'reformulation courte', test: /^(reformule|corrige l'orthographe|corrige les fautes|resume en une phrase|dis[- ]moi juste)\b/ },
];

/** Choix par les règles seules. Message court sans signal → Haiku ; long ou sans signal → Sonnet. */
export function ruleRoute(text: string): RuleResult {
  const t = normalize(text.trim());
  for (const rule of OPUS_SURE) if (rule.test.test(t)) return pick(rule);
  if (t.length > 1500) return { model: 'opus', sure: false, reason: 'message très long' };
  for (const rule of OPUS_GUESS) if (rule.test.test(t)) return pick(rule);
  // Entre Haiku et Sonnet, le plus fort gagne : « salut, explique-moi… » part sur Sonnet.
  for (const rule of SONNET) if (rule.test.test(t)) return pick(rule);
  for (const rule of HAIKU) if (rule.test.test(t) && t.length <= 160) return pick(rule);
  if (t.length <= 40) return { model: 'haiku', sure: false, reason: 'message court' };
  return { model: 'sonnet', sure: false, reason: 'cas général' };
}

function pick(rule: Rule): RuleResult {
  return { model: rule.model, sure: rule.sure, reason: rule.reason };
}

/** Consigne envoyée au juge : courte, pour économiser son quota gratuit. */
export const JUDGE_SYSTEM =
  "Tu choisis le modèle d'IA le plus économique capable de bien répondre au message. Réponds par UN seul mot : " +
  'haiku (salutation, fait simple, définition, traduction, calcul, reformulation courte), ' +
  'sonnet (explication, rédaction, conseil, résumé, question de cours, analyse moyenne), ' +
  'opus (code, programmation, bug, fichiers, tâche en plusieurs étapes, raisonnement difficile, maths avancées). ' +
  'En cas de doute entre deux, prends le plus fort.';

/** Le juge n'a pas besoin de tout lire : début et fin d'un long message suffisent. */
export function judgeExcerpt(text: string, head = 2000, tail = 500): string {
  return text.length <= head + tail ? text : `${text.slice(0, head)}\n[…]\n${text.slice(-tail)}`;
}

/** « Opus. » → opus ; rien de reconnaissable → null. */
export function parseJudge(answer: string): ModelChoice | null {
  const words = normalize(answer).match(/haiku|sonnet|opus/g);
  return words && new Set(words).size === 1 ? (words[0] as ModelChoice) : null;
}

export interface RouteContext {
  /** Modèle de la session au moment de l'envoi. */
  current?: ModelChoice;
  /** Tokens de contexte déjà utilisés par la session. */
  contextUsed?: number;
}

/** Décision finale : règles + juge + garde-fous (commandes, cache). */
export function decideRoute(text: string, rule: RuleResult, judge: ModelChoice | null, ctx: RouteContext = {}): Route {
  if (text.trim().startsWith('/')) {
    return { model: ctx.current ?? 'sonnet', reason: 'commande : modèle en cours gardé', source: 'gardé' };
  }
  let route: Route;
  if (!judge) route = { model: rule.model, reason: rule.reason, source: 'règles' };
  else if (rule.sure && RANK[rule.model] > RANK[judge]) route = { model: rule.model, reason: `${rule.reason} (plus fort que le juge)`, source: 'règles' };
  else route = { model: judge, reason: judge === rule.model ? `${rule.reason}, confirmé par le juge` : 'avis du juge', source: 'juge' };

  if (ctx.current && RANK[route.model] < RANK[ctx.current] && (ctx.contextUsed ?? 0) > STICKY_CONTEXT) {
    return { model: ctx.current, reason: 'conversation longue : changer relirait tout sans cache', source: 'gardé' };
  }
  return route;
}

export function isModelSetting(value: unknown): value is ModelSetting {
  return value === 'auto' || value === 'opus' || value === 'sonnet' || value === 'haiku';
}
