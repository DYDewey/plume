import type { HistoryProject, HistorySession } from '../../shared/history';
import { folderLabel } from './ui-format';

/**
 * Sessions lancées par des outils, pas par l'utilisateur : observateur claude-mem,
 * essais dans des dossiers temporaires (AppData\Local\Temp).
 */
export function isTechnicalProject(p: Pick<HistoryProject, 'folder' | 'path'>): boolean {
  return /claude-mem|AppData-Local-Temp/i.test(p.folder) || /[\\/]\.claude-mem([\\/]|$)|[\\/]AppData[\\/]Local[\\/]Temp[\\/]/i.test(p.path ?? '');
}

/** Dossier des conversations « sans dossier » de l'app (%APPDATA%/mon-claude/discussions). */
export function isChatFolder(p: Pick<HistoryProject, 'folder' | 'path'>): boolean {
  return /mon-claude-discussions$/i.test(p.folder) || /[\\/]mon-claude[\\/]discussions[\\/]?$/i.test(p.path ?? '');
}

/** Nom affiché du projet : « Discussion » pour une conversation sans dossier, sinon le dernier dossier du chemin. */
export function projectName(p: Pick<HistoryProject, 'folder' | 'path'>): string {
  if (isChatFolder(p)) return 'Discussion';
  return p.path ? folderLabel(p.path) : p.folder;
}

export interface HistoryRow {
  folder: string;
  session: HistorySession;
  /** Nom court du dossier de travail (« mon-claude »). */
  project: string;
}

export interface HistoryGroup {
  label: string;
  rows: HistoryRow[];
}

const DAY = 24 * 60 * 60 * 1000;

/** Toutes les sessions, de la plus récente à la plus ancienne, rangées par période (groupes vides retirés). */
export function groupByDate(projects: HistoryProject[], now: number): HistoryGroup[] {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const today = midnight.getTime();
  const bounds: [string, number][] = [
    ["Aujourd'hui", today],
    ['Hier', today - DAY],
    ['7 derniers jours', today - 6 * DAY],
    ['30 derniers jours', today - 29 * DAY],
    ['Plus ancien', -Infinity],
  ];
  const rows = projects
    .flatMap((p) => p.sessions.map((session) => ({ folder: p.folder, session, project: projectName(p) })))
    .sort((a, b) => b.session.lastAt - a.session.lastAt);
  const groups = bounds.map(([label]) => ({ label, rows: [] as HistoryRow[] }));
  for (const row of rows) {
    const i = bounds.findIndex(([, from]) => row.session.lastAt >= from);
    groups[i].rows.push(row);
  }
  return groups.filter((g) => g.rows.length > 0);
}

/** Heure pour aujourd'hui et hier, sinon date courte (« 3 nov. »). */
export function shortWhen(at: number, now: number): string {
  const d = new Date(at);
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  if (at >= midnight.getTime() - DAY) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}
