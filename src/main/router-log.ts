import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Qui a vraiment répondu ? Le flux de claude garde le nom du modèle demandé (ex. claude-sonnet-5-5)
 * même quand ccr a basculé sur Gemini : seul le journal de ccr connaît le modèle final.
 * Chaque requête y porte l'en-tête x-claude-code-session-id, qui est l'id de notre session.
 */

export interface Responder {
  /** Fournisseur ccr, ex. « Claude Code API » ou « Google Gemini ». */
  provider: string;
  /** Nom exact renvoyé par le fournisseur, ex. claude-sonnet-5-5 ou gemini-3.5-flash. */
  model: string;
}

export function routerLogPath(appData = process.env.APPDATA ?? ''): string {
  return join(appData, 'claude-code-router', 'request-logs.sqlite');
}

/** Dernière requête réussie de la session dans le journal ccr (lecture seule), ou null. */
export function lastResponder(dbPath: string, sessionId: string): Responder | null {
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
    const row = db
      .prepare(
        `select provider, coalesce(nullif(response_model, ''), resolved_model) as model from request_logs
         where ok = 1 and request_headers like ? order by id desc limit 1`,
      )
      .get(`%${sessionId}%`) as { provider?: unknown; model?: unknown } | undefined;
    if (typeof row?.provider !== 'string' || typeof row.model !== 'string' || !row.model) return null;
    return { provider: row.provider, model: row.model };
  } catch {
    return null; // journal absent, verrouillé ou format changé : pas de badge, rien de grave
  } finally {
    db?.close();
  }
}
