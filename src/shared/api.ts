import type { ChatItem } from './chat-item';
import type { BridgeEvent } from './events';
import type { HistoryProject } from './history';
import type { ModelChoice } from './model';
import type { OrganizeData } from './organize';
import type { SearchHit } from './search';

// API exposée au renderer sous `window.claude` par le preload.
export interface ClaudeApi {
  startSession(cwd: string, opts?: { resumeId?: string; model?: ModelChoice }): Promise<string>;
  sendMessage(sessionId: string, text: string): void;
  /** Ouvre la boîte de dialogue Windows ; renvoie le dossier choisi, ou null si annulé. */
  pickFolder(): Promise<string | null>;
  /** Boîte de dialogue Windows pour joindre des fichiers ; renvoie leurs chemins (vide si annulé). */
  pickFiles(): Promise<string[]>;
  /** Chemin d'un fichier glissé-déposé ('' s'il ne vient pas du disque). */
  pathForFile(file: File): string;
  /** Enregistre une image collée dans %APPDATA%/mon-claude/attachments/ ; renvoie son chemin. */
  savePastedImage(bytes: Uint8Array, ext: string): Promise<string>;
  /** Arrête la réponse en cours sans fermer la session. */
  interrupt(sessionId: string): void;
  stopSession(sessionId: string): void;
  /** Relance la session avec un autre modèle (undefined : « Par défaut ») ; la conversation continue. */
  setModel(sessionId: string, model: ModelChoice | undefined): Promise<void>;
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
}

export const IPC = {
  start: 'claude:start',
  send: 'claude:send',
  interrupt: 'claude:interrupt',
  pickFolder: 'claude:pick-folder',
  pickFiles: 'files:pick',
  savePasted: 'files:save-pasted',
  stop: 'claude:stop',
  setModel: 'session:set-model',
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
} as const;
