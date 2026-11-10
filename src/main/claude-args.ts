import type { ModelChoice } from '../shared/model';
import type { PermissionMode } from '../shared/settings';

export interface ClaudeArgsOptions {
  sessionId: string;
  /** true : reprendre la session existante sessionId au lieu d'en créer une. */
  resume?: boolean;
  /** Continuer une ancienne session dans une copie : sessionId reçoit la suite, l'original reste intact. Ignoré si resume. */
  forkFrom?: string;
  /** Absent : « Par défaut », le réglage de Claude Code s'applique. */
  model?: ModelChoice;
  /** Instructions et fichiers du projet du dossier (cf. projects.ts). */
  appendSystemPrompt?: string;
  /** Réglage « Autorisations » (défaut : auto). */
  permissionMode?: PermissionMode;
}

/** Identifiant de session de claude (UUID) : refuse tout ce qui pourrait devenir une option du CLI. */
export function isSessionId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
}

export function buildClaudeArgs({ sessionId, resume, forkFrom, model, appendSystemPrompt, permissionMode = 'auto' }: ClaudeArgsOptions): string[] {
  return [
    '-p',
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--verbose',
    '--include-partial-messages',
    // auto (défaut) : un classifieur laisse passer les actions sûres sans rien demander.
    '--permission-mode', permissionMode,
    // Ce qui serait refusé en silence nous est demandé (control_request sur stdout, cf. session-manager).
    '--permission-prompt-tool', 'stdio',
    // Suggestion du prochain message après chaque tour (il faut aussi la variable d'env, cf. session-manager).
    '--prompt-suggestions', 'true',
    ...(model ? ['--model', model] : []),
    ...(appendSystemPrompt ? ['--append-system-prompt', appendSystemPrompt] : []),
    // On choisit nous-mêmes l'identifiant : on le connaît avant la première réponse.
    ...(resume
      ? ['--resume', sessionId]
      : forkFrom
        ? ['--resume', forkFrom, '--fork-session', '--session-id', sessionId]
        : ['--session-id', sessionId]),
  ];
}
