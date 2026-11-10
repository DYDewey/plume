import type { PermissionDecision } from './events';

// Un élément affiché dans le chat. Partagé : le main convertit aussi l'historique dans ce format.
export type ChatItem =
  | { kind: 'user'; text: string }
  /** `uuid` : ligne du .jsonl de Claude Code, point de reprise pour « Modifier » un message suivant. */
  | { kind: 'assistant'; text: string; uuid?: string }
  | { kind: 'tool'; name: string; input: Record<string, unknown>; uuid?: string }
  | {
      kind: 'permission';
      requestId: string;
      toolName: string;
      input: Record<string, unknown>;
      description?: string;
      /** Règles enregistrées par « Toujours autoriser », lisibles (ex. Bash(npm test)). */
      rules: string[];
      /** Absente tant que la demande attend. */
      decision?: PermissionDecision;
    }
  | { kind: 'error'; message: string }
  | { kind: 'stopped' };
