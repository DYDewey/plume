import type { Route } from './auto-route';
import type { ChatItem } from './chat-item';
import type { BridgeEvent, PermissionDecision } from './events';
import type { HistoryProject } from './history';
import type { ModelChoice } from './model';
import type { OrganizeData } from './organize';
import type { SearchHit } from './search';
import type { Settings } from './settings';

// API exposée au renderer sous `window.claude` par le preload.
export interface ClaudeApi {
  startSession(cwd: string, opts?: { resumeId?: string; model?: ModelChoice; forkFrom?: string }): Promise<string>;
  sendMessage(sessionId: string, text: string): void;
  /** Ouvre la boîte de dialogue Windows ; renvoie le dossier choisi, ou null si annulé. */
  pickFolder(): Promise<string | null>;
  /** Boîte de dialogue Windows pour joindre des fichiers ; renvoie leurs chemins (vide si annulé). */
  pickFiles(): Promise<string[]>;
  /** Chemin d'un fichier glissé-déposé ('' s'il ne vient pas du disque). */
  pathForFile(file: File): string;
  /** Enregistre une image collée dans %APPDATA%/mon-claude/attachments/ ; renvoie son chemin. */
  savePastedImage(bytes: Uint8Array, ext: string): Promise<string>;
  /** Répond à une demande de permission de claude. */
  answerPermission(sessionId: string, requestId: string, decision: PermissionDecision): void;
  /** Arrête la réponse en cours sans fermer la session. */
  interrupt(sessionId: string): void;
  stopSession(sessionId: string): void;
  /** Relance la session avec un autre modèle (undefined : « Par défaut ») ; la conversation continue. */
  setModel(sessionId: string, model: ModelChoice | undefined): Promise<void>;
  /** Mode Auto : modèle conseillé pour ce message (règles + juge Gemini gratuit). */
  routeMessage(text: string, current?: ModelChoice, contextUsed?: number): Promise<Route>;
  /** Titre court proposé par le juge Gemini ; null si le but n'est pas encore clair ou si ccr est absent. */
  titleSession(userTexts: string[], lastReply: string): Promise<string | null>;
  /** Renvoie la fonction de désabonnement. */
  onEvent(cb: (event: BridgeEvent) => void): () => void;
  /** Anciennes sessions de ~/.claude/projects/, en lecture seule. */
  listHistory(): Promise<HistoryProject[]>;
  readHistory(folder: string, id: string): Promise<ChatItem[]>;
  /** Sessions dont le contenu contient tous les mots (au plus 50, plus récentes d'abord). */
  searchHistory(query: string): Promise<SearchHit[]>;
  /** Enregistre la passation relue dans %APPDATA%/mon-claude/handoffs/ ; renvoie le chemin du fichier. */
  saveHandoff(text: string, sessionId: string): Promise<string>;
  /** Favoris et noms personnalisés, lus dans %APPDATA%/mon-claude/organize.json. */
  getOrganize(): Promise<OrganizeData>;
  setOrganize(data: OrganizeData): Promise<void>;
  /** Pour chaque chemin : existe-t-il encore ? (dossier ou fichiers d'un projet) */
  pathsExist(paths: string[]): Promise<boolean[]>;
  /** Interrupteur « secours Gemini » (routeur ccr) ; pris en compte au prochain lancement de session. */
  getRouter(): Promise<boolean>;
  setRouter(enabled: boolean): Promise<void>;
  /** Réglages de l'app (%APPDATA%/mon-claude/settings.json). */
  getSettings(): Promise<Settings>;
  /** Enregistre les champs valides et renvoie les réglages complets. */
  setSettings(patch: Partial<Settings>): Promise<Settings>;
  /** Clic sur la notification « réponse terminée » : session à afficher. Renvoie le désabonnement. */
  onFocusSession(cb: (sessionId: string) => void): () => void;
  /** Boîte « Enregistrer sous » puis écrit le texte ; renvoie le chemin, ou null si annulé. */
  saveText(defaultName: string, text: string): Promise<string | null>;
  /** Imprime la conversation affichée en PDF (boîte « Enregistrer sous ») ; chemin ou null. */
  exportPdf(defaultName: string): Promise<string | null>;
  /** Dossier des conversations « sans dossier » (%APPDATA%/mon-claude/discussions), créé si besoin. */
  chatFolder(): Promise<string>;
  /** Confie une page d'artefact au main ; renvoie l'adresse artifact:// à mettre dans l'iframe. */
  showArtifact(html: string): Promise<string>;
}

export const IPC = {
  start: 'claude:start',
  send: 'claude:send',
  interrupt: 'claude:interrupt',
  permission: 'claude:permission',
  pickFolder: 'claude:pick-folder',
  pickFiles: 'files:pick',
  savePasted: 'files:save-pasted',
  stop: 'claude:stop',
  setModel: 'session:set-model',
  route: 'session:route',
  title: 'session:title',
  event: 'claude:event',
  historyList: 'history:list',
  historyRead: 'history:read',
  historySearch: 'history:search',
  handoffSave: 'handoff:save',
  organizeGet: 'organize:get',
  organizeSet: 'organize:set',
  pathsExist: 'paths:exist',
  routerGet: 'router:get',
  routerSet: 'router:set',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  focusSession: 'app:focus-session',
  saveText: 'export:save-text',
  exportPdf: 'export:pdf',
  showArtifact: 'artifact:show',
  chatFolder: 'chat:folder',
} as const;
