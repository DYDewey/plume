import type { HistoryProject, HistorySession } from '../../shared/history';
import { fold } from '../../shared/search';

/** Dernier dossier d'un chemin Windows ou POSIX (« mon-claude »), séparateur final ignoré. */
export function folderLabel(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}


/**
 * Historique filtré par une recherche : un projet dont le nom correspond garde toutes ses sessions,
 * sinon on ne garde que les sessions dont le titre affiché correspond. Les projets vides disparaissent.
 */
export function filterHistory(
  projects: HistoryProject[],
  query: string,
  titleOf: (folder: string, session: HistorySession) => string = (_folder, session) => session.title,
): HistoryProject[] {
  const q = fold(query.trim());
  if (!q) return projects;
  return projects.flatMap((p) => {
    if (fold(p.path ? folderLabel(p.path) : p.folder).includes(q)) return [p];
    const sessions = p.sessions.filter((s) => fold(titleOf(p.folder, s)).includes(q));
    return sessions.length ? [{ ...p, sessions }] : [];
  });
}

/** Ctrl+B seul (sans Maj, Alt ni Windows) : replier ou déplier la barre latérale. */
export function isSidebarToggle(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'>): boolean {
  return e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'b';
}

/** Ctrl+, : ouvrir ou fermer les paramètres. */
export function isSettingsShortcut(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'>): boolean {
  return e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.key === ',';
}

type Keys = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'>;

/** Ctrl+<lettre> seul : N nouvelle conversation, K recherche. */
export function isCtrlLetter(e: Keys, letter: string): boolean {
  return e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === letter;
}

/** Ctrl+Tab : +1 (session suivante) ; Ctrl+Maj+Tab : -1 (précédente) ; sinon 0. */
export function tabDirection(e: Keys): -1 | 0 | 1 {
  if (!e.ctrlKey || e.altKey || e.metaKey || e.key !== 'Tab') return 0;
  return e.shiftKey ? -1 : 1;
}

/** Session voisine dans la liste, en bouclant ; null s'il n'y en a pas d'autre. */
export function neighborSession(ids: string[], current: string | null, step: -1 | 1): string | null {
  if (ids.length === 0) return null;
  const at = current ? ids.indexOf(current) : -1;
  if (at === -1) return ids[step === 1 ? 0 : ids.length - 1];
  if (ids.length === 1) return null;
  return ids[(at + step + ids.length) % ids.length];
}

/** Champ de recherche de l'historique (Ctrl+K y met le curseur). */
export const HISTORY_SEARCH_ID = 'history-search';

// Barre latérale repliée ou non, retenue entre deux lancements de l'app.
const COLLAPSED_KEY = 'mon-claude:sidebar-collapsed';

export function readCollapsed(storage: Pick<Storage, 'getItem'>): boolean {
  try {
    return storage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeCollapsed(storage: Pick<Storage, 'setItem'>, collapsed: boolean): void {
  try {
    storage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // stockage indisponible : l'état ne sera pas retenu, sans gravité
  }
}

// Largeur du panneau d'artefact (px), réglée à la souris.
const ARTIFACT_WIDTH_KEY = 'mon-claude:artifact-width';
export const ARTIFACT_MIN_WIDTH = 320;
export const ARTIFACT_DEFAULT_WIDTH = 560;

/** Largeur gardée entre 320 px et 75 % de la fenêtre (le chat garde toujours de la place). */
export function clampWidth(width: number, windowWidth: number): number {
  const max = Math.max(ARTIFACT_MIN_WIDTH, Math.round(windowWidth * 0.75));
  return Math.round(Math.min(max, Math.max(ARTIFACT_MIN_WIDTH, width)));
}

export function readArtifactWidth(storage: Pick<Storage, 'getItem'>): number {
  try {
    const n = Number(storage.getItem(ARTIFACT_WIDTH_KEY));
    return Number.isFinite(n) && n >= ARTIFACT_MIN_WIDTH ? n : ARTIFACT_DEFAULT_WIDTH;
  } catch {
    return ARTIFACT_DEFAULT_WIDTH;
  }
}

export function writeArtifactWidth(storage: Pick<Storage, 'setItem'>, width: number): void {
  try {
    storage.setItem(ARTIFACT_WIDTH_KEY, String(width));
  } catch {
    // stockage indisponible : la largeur ne sera pas retenue
  }
}

// Dernier dossier de travail, proposé sur l'accueil.
const LAST_FOLDER_KEY = 'mon-claude:last-folder';

export function readLastFolder(storage: Pick<Storage, 'getItem'>): string | null {
  try {
    return storage.getItem(LAST_FOLDER_KEY) || null;
  } catch {
    return null;
  }
}

export function writeLastFolder(storage: Pick<Storage, 'setItem'>, folder: string): void {
  try {
    storage.setItem(LAST_FOLDER_KEY, folder);
  } catch {
    // stockage indisponible : le dossier sera redemandé
  }
}
