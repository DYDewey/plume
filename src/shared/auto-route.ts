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

// Testées sur le texte normalisé (minuscules, sans accents). On écrit donc les mots sans accents.
// Les listes peuvent contenir de petites regex (« tests? » = test ou tests).

/** Liste de mots → regex « mot entier » : w('bug', 'crash') trouve « un bug » mais pas « debugger ». */
const w = (...words: string[]) => new RegExp(`\\b(${words.join('|')})\\b`);

// ---------- Opus sûr : impossible de bien répondre sans un modèle fort ----------

/** Vocabulaire qui n'existe que dans le code. */
const DEV_WORDS = [
  // erreurs et débogage
  'bugs?', 'bogues?', 'debug(gue|ger|guer|ging)?', 'debogue[rz]?', 'crash(e|es|ent)?', 'plantage', 'freeze', 'fuite memoire', 'memory leak',
  'segfault', 'core dump', 'breakpoint', 'point d.arret', 'logcat', 'stacktrace', 'warning', 'deprecated',
  // actions sur du code
  'implemente[rz]?', 'implementation', 'refactor(ise|iser|ing|e)?', 'refacto', 'coder', 'codez', 'codes? source', 'programmer', 'compile[rz]?', 'compilation',
  'deploie[rz]?', 'deploiement', 'transpile', 'minifie', 'debouncer?', 'parser', 'parse[rz]?', 'serialise[rz]?',
  // git et outils
  'git', 'github', 'gitlab', 'commit(s|e|er)?', 'merge[rz]?', 'rebase', 'cherry[- ]pick', 'pull request', 'push(e|er)? (sur|vers) (github|gitlab|le depot)', 'depot git', 'repo(sitory)?', 'gitignore',
  'pipeline ci', 'ci/cd', 'github actions', 'workflow yaml', 'lint(er)?', 'eslint', 'prettier', 'typecheck', 'tests? unitaires?', 'tests? d.integration', 'vitest', 'jest', 'pytest', 'junit',
  'npm run', 'npm install', 'pip install', 'node_modules', 'package\\.json', 'requirements\\.txt', 'gradle(w)?', 'maven', 'cmake', 'makefile',
  // langages et frameworks
  'typescript', 'javascript', 'python', 'kotlin', 'java', 'rust', 'golang', 'php', 'swift', 'dart', 'flutter',
  'react', 'next\\.?js', 'vue\\.?js', 'angular', 'svelte', 'node\\.?js','django', 'flask', 'fastapi', 'spring( boot)?', 'laravel',
  'electron', 'vite', 'webpack', 'tailwind', 'jetpack compose', 'android studio', 'xcode', 'unity', 'godot', 'unreal',
  // notions de programmation
  'usestate', 'useeffect', 'hooks? react', 'async', 'await', 'promise', 'callback', 'closure', 'lambda', 'recursi(on|ve|f)', 'pointeurs?', 'malloc', 'mutex', 'thread(s)?',
  'variable (globale|locale|d.environnement)', 'boucle (for|while)', 'tableau (en|de) (js|python|c)', 'json', 'yaml', 'regex', 'expression reguliere',
  'endpoint', 'middleware', 'backend', 'frontend', 'full[- ]?stack', 'api (rest|graphql)', 'graphql', 'websocket', 'cors', 'jwt', 'oauth', 'sdk',
  'base de donnees', 'requete sql', 'sql', 'nosql', 'mongodb', 'postgres(ql)?', 'mysql', 'sqlite', 'firebase', 'supabase', 'orm', 'prisma', 'migration de (base|schema)',
  // système et terminal
  'powershell', 'bash', 'terminal', 'ligne de commande', 'invite de commande', 'cmd\\.exe', 'script (bat|shell|python|powershell)', 'variable path', 'localhost', 'port \\d{2,5}',
  'docker(file)?', 'kubernetes', 'k8s', 'ssh', 'cron', 'systemd', 'registre windows', 'dll', 'adb', 'apk', 'vulkan', 'shaders?', 'directx', 'opengl',
  // anglais
  'fix (the|this|my)', 'implement', 'refactor', 'debug', 'unit tests?', 'stack trace', 'compile', 'deploy', 'pull request', 'merge conflict', 'build (fails|failed|error)',
];

const OPUS_SURE: Rule[] = [
  { model: 'opus', sure: true, reason: 'code collé', test: /```|^\s*(import|export|def|class|function|const|let|var|public|private|#include|using|package|fun|func|SELECT|<\?php|<!doctype|<div|@Composable)\b/im },
  { model: 'opus', sure: true, reason: "trace d'erreur", test: /traceback|\bexception\b|stack ?trace|\berror:|\berreur ?:|\bat .+\(.+:\d+|\b(at|on) line \d+|a la ligne \d+|nullpointer|undefined is not|is not defined|cannot read propert|typeerror|syntaxerror|referenceerror|valueerror|keyerror|indexerror|attributeerror|modulenotfound|importerror|npm err|exit code|code de sortie|err_\w+|e\/androidruntime|fatal exception|\b(4\d\d|5\d\d) (not found|internal server error|bad request|unauthorized|forbidden)/ },
  { model: 'opus', sure: true, reason: 'fichier de code cité', test: /\b[\w./\\-]+\.(tsx?|jsx?|mjs|cjs|py|java|kt|kts|c|cc|cpp|h|hpp|cs|go|rs|rb|php|swift|dart|lua|sql|sh|ps1|bat|cmd|gradle|vue|svelte|html|css|scss|json|ya?ml|toml|xml|ini|ipynb|env|lock|md)\b/ },
  { model: 'opus', sure: true, reason: 'chemin ou pièce jointe', // « http:// » n'est pas un chemin Windows : on exclut « :// ».
    test: /\b[a-z]:[\\/](?!\/)|(^|\s)\.{0,2}\/[\w.-]+\/[\w.-]+/ },
  { model: 'opus', sure: true, reason: 'vocabulaire de code', test: w(...DEV_WORDS) },
  { model: 'opus', sure: true, reason: 'travail sur du code',
    // « code » seul, sauf code postal, code de la route…
    test: /\bc(\+\+|#)(?!\w)|\bcode\b(?! (postal|de la route|promo|pin|secret|civil|penal|vestimentaire|couleur|barre|wifi|parrainage))|\b(ca|il|elle|qui|l'appli|l'app|le jeu|le programme|le site|mon pc|windows) (plante|crashe?|bug(ue)?|freeze)\b|\b(corrige|repare|optimise|ameliore|nettoie|teste|relis|commente|documente)[rz]? (le|la|les|mon|ma|mes|ce|cette|ces|son|sa) (code|script|fonction|methode|classe|requete|appli|app|programme|erreur|bug|test|page|site|composant|module|api|projet)/ },
  { model: 'opus', sure: true, reason: 'création logicielle',
    test: /\b(cree|creer|fais|faire|ecris|ecrire|developpe|developper|ajoute|ajouter|construis|genere|code|programme|integre|branche|automatise|connecte)\b.{0,40}\b(app|appli|application|site( web)?|page web|landing page|api|fonction|methode|classe|script|composant|module|bot|extension|plugin|serveur|base de donnees|requete|endpoint|interface graphique|formulaire|bouton|jeu video|algorithme|regex|macro|widget|dashboard|tableau de bord|scraper|crawler|cli|outil en ligne de commande)\b/ },
  // Pas « sûr » : un souci de wifi ou de Windows n'a pas forcément besoin d'Opus, le juge tranche.
  { model: 'opus', sure: false, reason: 'souci technique',
    test: /\b(git|npm|pip|gradle|docker|vs ?code|android studio|powershell|python|node|java|wsl|linux|ubuntu|windows|virtualbox|wifi|pilote|driver|bios)\b.{0,60}\b(marche pas|marche plus|fonctionne pas|fonctionne plus|erreur|probleme|bloque|refuse|introuvable|n'est pas reconnu|not recognized|configure[rz]?|installe[rz]?|desinstalle[rz]?|mettre a jour)\b/ },
];

// ---------- Opus probable : raisonnement long ou difficile (le juge peut corriger) ----------

const OPUS_GUESS: Rule[] = [
  { model: 'opus', sure: false, reason: 'tâche complexe', test: w(
    'analyse (en profondeur|complete|detaillee|approfondie)', 'architecture', 'plan detaille', 'etape par etape', 'pas a pas', 'strategie', 'audit',
    'compare en detail', 'projet complet', 'cahier des charges', 'specifications?', 'conception', 'modelisation', 'uml', 'merise', 'mcd', 'diagramme de (classes?|sequence)',
    'optimise[rz]?', 'automatise[rz]?', 'business plan', 'etude de marche', 'memoire de (fin|stage)', 'these', 'step by step', 'in depth',
  ) },
  { model: 'opus', sure: false, reason: 'maths ou sciences difficiles', test: w(
    'demontre[rz]?', 'demonstration', 'preuve', 'par recurrence', 'theoreme', 'lemme', 'integrales?', 'derivees?', 'primitives?', 'matrices?', 'determinant', 'valeurs? propres?',
    'equations? differentielles?', 'limite de', 'suites? (recurrentes?|numeriques?)', 'series? entieres?', 'probabilites? conditionnelles?', 'loi (normale|binomiale|de poisson)',
    'esperance', 'variance', 'denombrement', 'complexite (algorithmique|en temps)', 'grand o', 'graphes?', 'dijkstra', 'automates?', 'logique booleenne', 'tables? de verite',
    'thermodynamique', 'mecanique quantique', 'electromagnetisme', 'optique', 'cinematique', 'resous', 'resoudre', 'exercices?', 'probleme de maths', 'prove',
  ) },
  { model: 'opus', sure: false, reason: 'réseau ou sécurité', test: w(
    'sous[- ]reseaux?', 'subnet(ting)?', 'masque de sous[- ]reseau', 'cidr', 'vlsm', 'vlans?', 'ospf', 'bgp', 'rip', 'eigrp', 'routage', 'table de routage', 'nat', 'acl',
    'iptables', 'pare[- ]feu', 'firewall', 'vpn', 'wireshark', 'nmap', 'packet tracer', 'cisco', 'gns3', 'pentest', 'ctf', 'exploit', 'injection sql', 'xss', 'csrf',
    'chiffrement', 'cryptographie', 'rsa', 'aes', 'hash(age)?', 'certificat ssl', 'tls', 'active directory', 'gpo', 'serveur dns', 'serveur dhcp',
  ) },
];

// ---------- Sonnet : réponse construite, sans code ni raisonnement très long ----------

const SONNET: Rule[] = [
  { model: 'sonnet', sure: false, reason: 'explication', test: w(
    'explique[rz]?', 'explication', 'pourquoi', 'comment (ca|fonctionne|marche|faire|fait[- ]on|on fait|je peux|puis[- ]je)', 'difference entre', 'quelle est la difference',
    'aide[- ]moi a comprendre', 'je comprends pas', 'j.ai pas compris', 'cours sur', 'fiche (de revision)?', 'revision', 'reviser', 'resume[rz]? (ce|cet|cette|le|la|les)',
    'qcm', 'quiz', 'interroge[- ]moi', 'questions? de revision', 'analyse (ce|cet|cette|le|la) (texte|poeme|document|image|graphique)', 'commentaire (de texte|compose)',
    'explain', 'why', 'how (does|do|to|can)', 'summari[sz]e',
  ) },
  { model: 'sonnet', sure: false, reason: 'rédaction', test: w(
    'redige[rz]?', 'redaction', 'ecris[- ](moi )?(un|une|des)', 'ecrire (un|une|des)', 'mail', 'e-?mail', 'lettre', 'courrier', 'message (a|pour) (mon|ma|mes)', 'dissertation',
    'lettre de motivation', 'cv', 'rapport( de stage)?', 'compte[- ]rendu', 'discours', 'post (linkedin|instagram)', 'paragraphe', 'introduction', 'conclusion', 'argumentaire',
    'histoire', 'poeme', 'chanson', 'slogan', 'description', 'presentation (orale)?', 'diapo(rama)?s?', 'slides?', 'oral', 'soutenance', 'write (an?|me)',
  ) },
  { model: 'sonnet', sure: false, reason: 'conseil ou avis', test: w(
    'conseils?', 'conseille[rz]?', 'recommande[rz]?', 'que penses[- ]tu', 'ton avis', 'qu.en penses[- ]tu', 'aide[- ]moi a (choisir|decider)', 'lequel (choisir|prendre)', 'laquelle',
    'vaut[- ]il mieux', 'est[- ]ce que je (dois|devrais)', 'idees? (de|pour)', 'brainstorm', 'suggestions?', 'propose[- ]moi', 'organise[rz]?', 'planning', 'emploi du temps',
    'budget', 'recette', 'programme (de|d.)(sport|musculation|entrainement|revision)', 'voyage', 'itineraire', 'orientation', 'stage', 'alternance', 'entretien d.embauche',
  ) },
  { model: 'sonnet', sure: false, reason: 'question détaillée', test: w(
    'liste[rz]?', 'compare[rz]?', 'comparaison', 'avantages?', 'inconvenients?', 'exemples?', 'details?', 'en detail', 'developpe', 'approfondis', 'causes?', 'consequences?',
    'histoire de', 'histoire du', 'biographie', 'philosophie', 'litterature', 'economie', 'geopolitique', 'droit', 'biologie', 'chimie', 'physique',
  ) },
];

// ---------- Haiku : réponse courte et facile ----------

const HAIKU: Rule[] = [
  { model: 'haiku', sure: false, reason: 'politesse',
    test: /^(salut|slt|bonjour|bjr|bonsoir|coucou|cc|re|hello|hey|hi|yo|wesh|merci|mrc|thanks|thx|ok|okay|oki|d'accord|d'acc|dac|cool|super|top|parfait|nickel|genial|trop bien|oui|ouais|non|nan|bien|ca va|tranquille|bonne (nuit|journee|soiree)|a plus|a\+|a demain|bye|lol|mdr|ptdr|haha|ah ok|je vois|compris|vu|bravo|gg)\b.{0,25}$/ },
  { model: 'haiku', sure: false, reason: 'définition rapide',
    test: /^(c'est quoi|c quoi|cest quoi|qu'est[- ]ce que?|qu'est[- ]ce qu'un|que veut dire|que signifie|ca veut dire quoi|ca signifie quoi|definition|definis|signification|sens du mot|what is|what's|what does .+ mean)\b/ },
  { model: 'haiku', sure: false, reason: 'traduction ou langue', test: w(
    'tradui[st]', 'traduction', 'traduire', 'translate', 'en anglais', 'en espagnol', 'en allemand', 'en italien', 'synonymes?', 'antonymes?', 'contraire de', 'conjugue[rz]?',
    'conjugaison', 'orthographe', 'comment (on dit|dit[- ]on|ca s.ecrit|s.ecrit)', 'pluriel de', 'feminin de', 'accord du participe', 'acronyme', 'abreviation', 'rime avec',
  ) },
  { model: 'haiku', sure: false, reason: 'fait simple',
    test: /^(combien|quand|quel(le)?s? (est|sont|age|jour|heure|annee|date|capitale|pays|taille|poids|population|monnaie|langue|distance)|qui (est|a|etait|sont)|ou (est|se trouve|se situe)|en quelle annee|a quelle (heure|date)|est[- ]ce que .{0,40}\?$|vrai ou faux)\b/ },
  { model: 'haiku', sure: false, reason: 'calcul ou conversion',
    test: /^[\d\s.,+\-*/x×÷()%^=?]+$|\b(convertis|conversion|calcule|combien font|combien fait|fait combien)\b.{0,30}\d|\b\d+([.,]\d+)? ?(km|m|cm|mm|kg|g|l|ml|°c|°f|euros?|€|\$|dollars?|miles?|heures?|minutes?) en (km|m|cm|mm|kg|g|l|ml|°c|°f|euros?|dollars?|miles?|heures?|minutes?|secondes?)\b/ },
  { model: 'haiku', sure: false, reason: 'petite demande', test: w(
    'reformule[rz]?', 'corrige (l.orthographe|les fautes|mes fautes|cette phrase)', 'resume en une phrase', 'en un mot', 'dis[- ]moi juste', 'juste (oui|non)', 'rapidement',
    'en majuscules?', 'en minuscules?', 'une blague', 'pile ou face', 'nombre (au hasard|aleatoire)', 'un prenom', 'donne[- ]moi un mot', 'emoji',
  ) },
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
