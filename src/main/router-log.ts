import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { LimitWindow } from '../shared/events';
import { bareModel } from '../shared/model';

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

export interface RouterLimits {
  fiveHour?: LimitWindow;
  sevenDay?: LimitWindow;
}

function limitWindow(headers: Record<string, unknown>, name: '5h' | '7d'): LimitWindow | undefined {
  const utilization = headers[`anthropic-ratelimit-unified-${name}-utilization`];
  const resetsAt = headers[`anthropic-ratelimit-unified-${name}-reset`];
  if (utilization === undefined || resetsAt === undefined) return undefined;
  const window = { utilization: Number(utilization), resetsAt: Number(resetsAt) };
  return Number.isFinite(window.utilization) && Number.isFinite(window.resetsAt) ? window : undefined;
}

/**
 * Jauges de l'abonnement : via la passerelle, claude n'envoie plus rate_limit_event, mais ccr garde
 * les en-têtes de la dernière réponse d'Anthropic. Les limites sont celles du compte, toutes sessions confondues.
 */
export function lastLimits(dbPath: string): RouterLimits | null {
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
    const row = db
      .prepare(`select response_headers as headers from request_logs where response_headers like '%unified-5h-utilization%' order by id desc limit 1`)
      .get() as { headers?: unknown } | undefined;
    if (typeof row?.headers !== 'string') return null;
    const headers = JSON.parse(row.headers) as Record<string, unknown>;
    const fiveHour = limitWindow(headers, '5h');
    const sevenDay = limitWindow(headers, '7d');
    return fiveHour || sevenDay ? { fiveHour, sevenDay } : null;
  } catch {
    return null; // journal absent, verrouillé ou format changé : les jauges restent telles quelles
  } finally {
    db?.close();
  }
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
        `select provider, requested_model as requested, response_model as response, resolved_model as resolved
         from request_logs where ok = 1 and request_headers like ? order by id desc limit 1`,
      )
      .get(`%${sessionId}%`) as Record<string, unknown> | undefined;
    const text = (v: unknown) => (typeof v === 'string' ? bareModel(v) : '');
    const requested = text(row?.requested);
    const response = text(row?.response);
    const resolved = text(row?.resolved);
    // Juste après la réponse, ccr n'a parfois pas encore remplacé response_model : il répète le modèle demandé.
    const model = response && response !== requested ? response : resolved || response;
    if (typeof row?.provider !== 'string' || !model) return null;
    return { provider: row.provider, model };
  } catch {
    return null; // journal absent, verrouillé ou format changé : pas de badge, rien de grave
  } finally {
    db?.close();
  }
}
