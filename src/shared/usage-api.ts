import type { LimitWindow } from './events';

// Jauges de l'abonnement lues chez Anthropic (même source que la commande /usage de Claude Code).
// Aucun message envoyé, aucun quota consommé.

export const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';

function window(raw: unknown): LimitWindow | undefined {
  const w = raw as { utilization?: unknown; resets_at?: unknown } | undefined;
  if (typeof w?.utilization !== 'number' || typeof w.resets_at !== 'string') return undefined;
  const resetsAt = Date.parse(w.resets_at);
  if (Number.isNaN(resetsAt)) return undefined;
  // L'API donne un pourcentage (81.0) ; l'app travaille de 0 à 1, et en secondes Unix pour la remise à zéro.
  return { utilization: Math.min(1, Math.max(0, w.utilization / 100)), resetsAt: Math.round(resetsAt / 1000) };
}

/** Réponse de l'API → jauges 5 h et 7 jours ; null si rien d'utilisable. */
export function parseUsage(json: unknown): { fiveHour?: LimitWindow; sevenDay?: LimitWindow } | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as { five_hour?: unknown; seven_day?: unknown };
  const fiveHour = window(o.five_hour);
  const sevenDay = window(o.seven_day);
  return fiveHour || sevenDay ? { ...(fiveHour && { fiveHour }), ...(sevenDay && { sevenDay }) } : null;
}

/**
 * Jeton de connexion de Claude Code, seulement s'il est encore valable au moins une minute.
 * On ne le renouvelle jamais : ça changerait la connexion de Claude Code.
 */
export function usableToken(credentials: unknown, now: number): string | null {
  const o = (credentials as { claudeAiOauth?: { accessToken?: unknown; expiresAt?: unknown } } | null)?.claudeAiOauth;
  if (typeof o?.accessToken !== 'string' || !o.accessToken) return null;
  if (typeof o.expiresAt === 'number' && o.expiresAt < now + 60_000) return null;
  return o.accessToken;
}
