import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Routeur claude-code-router (ccr) : avec le profil `mix`, claude passe par une passerelle locale
 * qui bascule seule vers Gemini (clé gratuite) quand le quota Claude est épuisé.
 * Si le routeur est désactivé, absent ou ne démarre pas, on lance claude directement.
 *
 * On lance le vrai `claude` avec des variables d'environnement, pas `ccr mix cli` : ce lanceur change
 * CLAUDE_CONFIG_DIR, donc les sessions partaient hors de ~/.claude (absentes de l'historique,
 * --resume impossible) et les skills perso n'étaient plus chargés.
 */

/** Ce que SessionManager doit lancer. */
export interface Launcher {
  command: string;
  prefixArgs: string[];
  /** Variables d'environnement à ajouter au lancement. */
  env?: Record<string, string>;
}

export const DIRECT: Launcher = { command: 'claude', prefixArgs: [] };

export const GATEWAY_URL = 'http://127.0.0.1:3456';

/** Script de ccr installé par `npm i -g` (c'est lui que lance ccr.ps1). */
export function routerCliPath(appData = process.env.APPDATA ?? ''): string {
  return join(appData, 'npm', 'node_modules', '@musistudio', 'claude-code-router', 'dist', 'main', 'cli.js');
}

/** Jeton d'accès à la passerelle pour le profil `mix` (créé par ccr). */
export function routerTokenPath(appData = process.env.APPDATA ?? ''): string {
  return join(appData, 'claude-code-router', 'bin', 'ccr-claude-code-wif-token-mix.txt');
}

/** Jeton lu à chaque lancement ; null si ccr n'est pas configuré. */
export function readRouterToken(path = routerTokenPath()): string | null {
  try {
    return readFileSync(path, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

/** Mêmes réglages que le profil `mix` de ccr, sans son CLAUDE_CONFIG_DIR. */
export function routerLauncher(token: string): Launcher {
  return {
    command: 'claude',
    prefixArgs: [],
    env: {
      ANTHROPIC_BASE_URL: GATEWAY_URL,
      ANTHROPIC_AUTH_TOKEN: token,
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'Claude Code API/claude-opus-5-5[1m]',
      ANTHROPIC_DEFAULT_SONNET_MODEL: 'Claude Code API/claude-sonnet-5-5[1m]',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'Claude Code API/claude-haiku-5-5[1m]',
      CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT: '1',
      NO_PROXY: '127.0.0.1,localhost,::1',
    },
  };
}

/** La passerelle répond-elle ? N'importe quelle réponse HTTP suffit. */
export async function gatewayUp(url = GATEWAY_URL, timeoutMs = 1500): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return true;
  } catch {
    return false;
  }
}

export interface RouterDeps {
  enabled: () => boolean;
  /** Jeton de la passerelle ; null : ccr absent, on lance claude directement. */
  token: () => string | null;
  isUp?: () => Promise<boolean>;
  /** Démarre la passerelle en arrière-plan (sans attendre qu'elle soit prête). */
  startGateway: () => void;
  /** Temps d'attente max après un démarrage (ccr met ~4 s). */
  waitMs?: number;
  pollMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

/** Interrupteur lu dans router.json ; activé par défaut (fichier absent ou illisible). */
export function loadRouterEnabled(dir: string): boolean {
  try {
    const data: unknown = JSON.parse(readFileSync(join(dir, 'router.json'), 'utf8'));
    return !(data && typeof data === 'object' && (data as { enabled?: unknown }).enabled === false);
  } catch {
    return true;
  }
}

export function saveRouterEnabled(dir: string, enabled: boolean): void {
  writeFileSync(join(dir, 'router.json'), JSON.stringify({ enabled }) + '\n', 'utf8');
}

/** Renvoie une fonction qui choisit quoi lancer ; un seul démarrage de la passerelle à la fois. */
export function createRouterChooser(deps: RouterDeps): () => Promise<Launcher> {
  const isUp = deps.isUp ?? (() => gatewayUp());
  const waitMs = deps.waitMs ?? 12000;
  const pollMs = deps.pollMs ?? 500;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let starting: Promise<boolean> | null = null;

  const startAndWait = async (): Promise<boolean> => {
    deps.startGateway();
    for (let waited = 0; waited < waitMs; waited += pollMs) {
      await sleep(pollMs);
      if (await isUp()) return true;
    }
    return false;
  };

  return async () => {
    const token = deps.enabled() ? deps.token() : null;
    if (!token) return DIRECT;
    if (await isUp()) return routerLauncher(token);
    starting ??= startAndWait().finally(() => (starting = null));
    return (await starting) ? routerLauncher(token) : DIRECT;
  };
}
