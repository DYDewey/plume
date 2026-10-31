import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Routeur claude-code-router (ccr) : avec le profil `mix`, claude passe par une passerelle locale
 * qui bascule seule vers Gemini (clé gratuite) quand le quota Claude est épuisé.
 * Si le routeur est désactivé, absent ou ne démarre pas, on lance claude directement.
 */

/** Ce que SessionManager doit lancer. */
export interface Launcher {
  command: string;
  prefixArgs: string[];
}

export const DIRECT: Launcher = { command: 'claude', prefixArgs: [] };

export const GATEWAY_URL = 'http://127.0.0.1:3456';

/** Script de ccr installé par `npm i -g` (c'est lui que lance ccr.ps1). */
export function routerCliPath(appData = process.env.APPDATA ?? ''): string {
  return join(appData, 'npm', 'node_modules', '@musistudio', 'claude-code-router', 'dist', 'main', 'cli.js');
}

/** `node cli.js mix cli -- <args de claude>` : on évite ccr.cmd, qui demanderait un shell (et ses pièges de guillemets). */
export function routerLauncher(cli: string): Launcher {
  return { command: 'node', prefixArgs: [cli, 'mix', 'cli', '--'] };
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
  cli: string;
  exists?: (path: string) => boolean;
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
  const exists = deps.exists ?? existsSync;
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
    if (!deps.enabled() || !exists(deps.cli)) return DIRECT;
    if (await isUp()) return routerLauncher(deps.cli);
    starting ??= startAndWait().finally(() => (starting = null));
    return (await starting) ? routerLauncher(deps.cli) : DIRECT;
  };
}
