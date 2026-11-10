import { appendFile } from 'node:fs/promises';
import { judgeExcerpt, JUDGE_SYSTEM, parseJudge, type Route, type RuleResult } from '../shared/auto-route';
import type { ModelChoice } from '../shared/model';
import { cleanTitle, TITLE_SYSTEM } from '../shared/auto-title';
import { GATEWAY_URL } from './router';

/**
 * Juge du mode Auto : Gemini Flash-Lite, appelé via la passerelle ccr (la clé gratuite reste dans ccr).
 * Ne coûte aucun token Claude. Toute panne renvoie null : les règles décident alors seules.
 */
export const JUDGE_MODEL = 'Google Gemini/gemini-3.5-flash-lite';

export interface JudgeDeps {
  /** Jeton de la passerelle ; null : ccr absent ou désactivé, pas de juge. */
  token: string | null;
  fetch?: typeof fetch;
  timeoutMs?: number;
  url?: string;
}

/** Un appel à Gemini via ccr ; renvoie le texte de la réponse, ou null en cas de souci. */
async function askGemini(system: string, content: string, maxTokens: number, deps: JudgeDeps): Promise<string | null> {
  if (!deps.token) return null;
  const doFetch = deps.fetch ?? fetch;
  try {
    const res = await doFetch(`${deps.url ?? GATEWAY_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${deps.token}`,
        'x-api-key': deps.token,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: JUDGE_MODEL,
        max_tokens: maxTokens,
        temperature: 0,
        system,
        messages: [{ role: 'user', content }],
      }),
      signal: AbortSignal.timeout(deps.timeoutMs ?? 4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { model?: unknown; content?: { type?: string; text?: unknown }[] };
    // Si ccr a répondu avec un modèle Claude (bascule inattendue), on ne s'y fie pas : ça coûterait du quota.
    if (typeof data.model === 'string' && data.model.includes('claude')) return null;
    const answer = data.content?.find((c) => c.type === 'text')?.text;
    return typeof answer === 'string' ? answer : null;
  } catch {
    return null; // passerelle arrêtée, délai dépassé, quota Gemini…
  }
}

export async function askJudge(text: string, deps: JudgeDeps): Promise<ModelChoice | null> {
  // 5 coupait la réponse en plein mot (« ha ») : Gemini compte aussi sa réflexion interne.
  const answer = await askGemini(JUDGE_SYSTEM, `Message :\n"""\n${judgeExcerpt(text)}\n"""`, 50, deps);
  return answer === null ? null : parseJudge(answer);
}

/** Titre court de la conversation, ou null si le but n'est pas encore clair (ou panne). */
export async function askTitle(excerpt: string, deps: JudgeDeps): Promise<string | null> {
  const answer = await askGemini(TITLE_SYSTEM, `Conversation :\n"""\n${excerpt}\n"""`, 80, { timeoutMs: 8000, ...deps });
  return answer === null ? null : cleanTitle(answer);
}

/** Une ligne par décision, pour améliorer les règles plus tard (fichier local, jamais envoyé). */
export async function logRoute(path: string, text: string, rule: RuleResult, judge: ModelChoice | null, route: Route, at = new Date()): Promise<void> {
  const line = { at: at.toISOString(), debut: text.slice(0, 80), regle: rule, juge: judge, choix: route };
  try {
    await appendFile(path, JSON.stringify(line) + '\n', 'utf8');
  } catch {
    // journal facultatif
  }
}
