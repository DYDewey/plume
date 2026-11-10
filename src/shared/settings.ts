// Réglages de l'app, enregistrés par main dans %APPDATA%/mon-claude/settings.json.

export type Theme = 'system' | 'light' | 'dark';
export type TextSize = 'small' | 'normal' | 'large';
export type SendKey = 'enter' | 'ctrl-enter';
/** Modes du CLI proposés dans l'app (jamais bypassPermissions). */
export type PermissionMode = 'auto' | 'acceptEdits' | 'manual';

export interface Settings {
  theme: Theme;
  textSize: TextSize;
  sendKey: SendKey;
  permissionMode: PermissionMode;
  /** Montrer aussi les sessions techniques (claude-mem…) dans l'historique. */
  showTechnical: boolean;
  /** Notification Windows quand une réponse finit et que la fenêtre n'est pas au premier plan. */
  notify: boolean;
  /** Proposer une passation quand le contexte dépasse HANDOFF_THRESHOLD. */
  autoHandoff: boolean;
  /** Claude produit des artefacts (page HTML, SVG, Mermaid) quand un visuel aide ; aperçu ouvert tout seul. */
  autoArtifacts: boolean;
}

/** Part du contexte à partir de laquelle la passation est proposée. */
export const HANDOFF_THRESHOLD = 0.7;

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  textSize: 'normal',
  sendKey: 'enter',
  permissionMode: 'auto',
  showTechnical: false,
  notify: true,
  autoHandoff: true,
  autoArtifacts: true,
};

const CHOICES = {
  theme: ['system', 'light', 'dark'],
  textSize: ['small', 'normal', 'large'],
  sendKey: ['enter', 'ctrl-enter'],
  permissionMode: ['auto', 'acceptEdits', 'manual'],
} as const;

/** Garde chaque champ valide ; tout le reste (inconnu, mauvais type) prend la valeur par défaut. */
export function parseSettings(value: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const o = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const pick = <K extends keyof typeof CHOICES>(key: K): Settings[K] =>
    (CHOICES[key] as readonly unknown[]).includes(o[key]) ? (o[key] as Settings[K]) : base[key];
  const bool = (key: 'showTechnical' | 'notify' | 'autoHandoff' | 'autoArtifacts'): boolean =>
    typeof o[key] === 'boolean' ? (o[key] as boolean) : base[key];
  return {
    theme: pick('theme'),
    textSize: pick('textSize'),
    sendKey: pick('sendKey'),
    permissionMode: pick('permissionMode'),
    showTechnical: bool('showTechnical'),
    notify: bool('notify'),
    autoHandoff: bool('autoHandoff'),
    autoArtifacts: bool('autoArtifacts'),
  };
}
