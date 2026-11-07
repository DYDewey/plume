import type { BridgeEvent, LimitWindow, PermissionSuggestion } from '../shared/events';
import { bareModel } from '../shared/model';

export interface StreamParser {
  /** Reçoit un morceau de stdout, renvoie les événements des lignes complètes. */
  push(chunk: string): BridgeEvent[];
}

export function createStreamParser(sessionId: string): StreamParser {
  // stdout arrive par morceaux arbitraires : on garde la fin de ligne incomplète ici.
  let buffer = '';
  // Dernier message assistant : sa taille = contexte actuel, envoyée au `result` (qui donne le max).
  const last: LastMessage = {};

  return {
    push(chunk) {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      return lines.flatMap((line) => parseLine(line.trim(), sessionId, last));
    },
  };
}

interface LastMessage {
  model?: string;
  tokens?: number;
}

function parseLine(line: string, sessionId: string, last: LastMessage): BridgeEvent[] {
  if (!line) return [];
  let msg: Record<string, unknown>;
  try {
    msg = JSON.parse(line);
  } catch {
    console.warn('[cli-bridge] ligne non JSON ignorée :', line.slice(0, 200));
    return [];
  }

  if (msg.type === 'stream_event') {
    const event = msg.event as { type?: string; delta?: { type?: string; text?: string } } | undefined;
    if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
      return [{ type: 'text-delta', sessionId, text: event.delta.text }];
    }
    return [];
  }

  if (msg.type === 'assistant') {
    // Avec --include-partial-messages, chaque bloc terminé arrive dans son propre message assistant.
    const message = msg.message as { content?: unknown; model?: unknown; usage?: Record<string, unknown> } | undefined;
    if (message?.usage) {
      last.model = typeof message.model === 'string' ? message.model : undefined;
      last.tokens = ['input_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens', 'output_tokens']
        .map((key) => message.usage?.[key])
        .reduce<number>((sum, n) => sum + (typeof n === 'number' ? n : 0), 0);
    }
    const content = message?.content;
    if (!Array.isArray(content)) return [];
    return content
      .filter((block) => block?.type === 'tool_use' && typeof block.name === 'string')
      .map((block) => ({ type: 'tool-use', sessionId, name: block.name, input: block.input ?? {} }));
  }

  if (msg.type === 'result') {
    const result = typeof msg.result === 'string' ? msg.result : undefined;
    const costUsd = typeof msg.total_cost_usd === 'number' ? msg.total_cost_usd : undefined;
    const end: BridgeEvent = { type: 'turn-end', sessionId, result, ...(costUsd !== undefined && { costUsd }) };
    if (msg.is_error) {
      return [{ type: 'error', sessionId, message: result ?? String(msg.subtype ?? 'erreur inconnue') }, end];
    }
    const max = contextWindow(msg.modelUsage, last.model);
    if (max && last.tokens) return [{ type: 'context', sessionId, used: last.tokens, max }, end];
    return [end];
  }

  if (msg.type === 'rate_limit_event') {
    const windows = (msg.rate_limit_info as { unifiedWindows?: Record<string, unknown> } | undefined)?.unifiedWindows;
    return [{ type: 'rate-limits', sessionId, fiveHour: limitWindow(windows?.five_hour), sevenDay: limitWindow(windows?.seven_day) }];
  }

  if (msg.type === 'prompt_suggestion' && typeof msg.suggestion === 'string' && msg.suggestion.trim()) {
    return [{ type: 'suggestion', sessionId, text: msg.suggestion.trim() }];
  }

  if (msg.type === 'system' && msg.subtype === 'init') {
    const events: BridgeEvent[] = [];
    if (Array.isArray(msg.slash_commands)) {
      const names = msg.slash_commands.filter((n): n is string => typeof n === 'string');
      events.push({ type: 'commands', sessionId, names });
    }
    if (typeof msg.model === 'string') events.push({ type: 'model', sessionId, model: bareModel(msg.model) });
    return events;
  }

  if (msg.type === 'control_request') {
    const request = msg.request as Record<string, unknown> | undefined;
    if (request?.subtype !== 'can_use_tool' || typeof msg.request_id !== 'string' || typeof request.tool_name !== 'string') return [];
    const input = request.input && typeof request.input === 'object' ? (request.input as Record<string, unknown>) : {};
    return [{
      type: 'permission-request',
      sessionId,
      requestId: msg.request_id,
      toolName: request.tool_name,
      input,
      ...(typeof request.description === 'string' && { description: request.description }),
      suggestions: localRules(request.permission_suggestions),
      ...(request.requires_user_interaction === true && { interactive: true }),
    }];
  }

  if (msg.type === 'control_cancel_request' && typeof msg.request_id === 'string') {
    return [{ type: 'permission-resolved', sessionId, requestId: msg.request_id, decision: 'deny' }];
  }

  // Autres system/*… : pas utiles au renderer pour l'instant.
  return [];
}

/**
 * Seules les règles d'autorisation sont gardées, et toujours pour le dossier de travail :
 * « Toujours autoriser » ne doit jamais toucher ~/.claude/settings.json ni changer de mode.
 */
function localRules(raw: unknown): PermissionSuggestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((s: { type?: unknown; behavior?: unknown; rules?: unknown }) => {
    if (s?.type !== 'addRules' || s.behavior !== 'allow' || !Array.isArray(s.rules)) return [];
    const rules = s.rules.filter((r): r is PermissionSuggestion['rules'][number] => typeof r?.toolName === 'string');
    return rules.length ? [{ type: 'addRules' as const, behavior: 'allow' as const, destination: 'localSettings' as const, rules }] : [];
  });
}

function limitWindow(raw: unknown): LimitWindow | undefined {
  const w = raw as { utilization?: unknown; resetsAt?: unknown } | undefined;
  if (typeof w?.utilization !== 'number' || typeof w.resetsAt !== 'number') return undefined;
  return { utilization: w.utilization, resetsAt: w.resetsAt };
}

/** contextWindow du modèle du dernier message ; à défaut, le plus grand (des sous-agents peuvent apparaître). */
function contextWindow(modelUsage: unknown, model: string | undefined): number | undefined {
  if (!modelUsage || typeof modelUsage !== 'object') return undefined;
  const entries = modelUsage as Record<string, { contextWindow?: unknown }>;
  const windowOf = (m: string) => (typeof entries[m]?.contextWindow === 'number' ? (entries[m].contextWindow as number) : 0);
  const max = model && windowOf(model) ? windowOf(model) : Math.max(0, ...Object.keys(entries).map(windowOf));
  return max || undefined;
}
