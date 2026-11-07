import type { PermissionDecision } from './events';

// Un élément affiché dans le chat. Partagé : le main convertit aussi l'historique dans ce format.
export type ChatItem =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool'; name: string; input: Record<string, unknown> }
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
