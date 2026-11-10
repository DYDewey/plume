import { ChevronDown, Folder, MessageSquare, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import type { HistoryProject } from '../../../shared/history';
import { displayTitle, sessionKey, type OrganizeData } from '../../../shared/organize';
import { isTechnicalProject, shortWhen } from '../history-groups';
import { folderLabel } from '../ui-format';
import { Logo } from './logo';

/** « Bonjour » le jour, « Bonsoir » à partir de 18 h et la nuit. */
export function greeting(hour: number): string {
  return hour >= 5 && hour < 18 ? 'Bonjour' : 'Bonsoir';
}

export interface RecentSession {
  folder: string;
  id: string;
  title: string;
  /** « projet · heure » */
  meta: string;
}

/** Les dernières conversations (sans les sessions techniques), pour les reprendre d'un clic depuis l'accueil. */
export function recentSessions(projects: HistoryProject[], organize: OrganizeData, now: number, count = 3): RecentSession[] {
  return projects
    .filter((p) => !isTechnicalProject(p))
    .flatMap((p) => p.sessions.map((s) => ({ p, s })))
    .sort((a, b) => b.s.lastAt - a.s.lastAt)
    .slice(0, count)
    .map(({ p, s }) => ({
      folder: p.folder,
      id: s.id,
      title: displayTitle(s, organize.sessions[sessionKey(p.folder, s.id)]),
      meta: `${p.path ? folderLabel(p.path) : p.folder} · ${shortWhen(s.lastAt, now)}`,
    }));
}

/** Dossier de travail de la prochaine conversation, à côté du trombone. */
export function FolderChip({ folder, onPick }: { folder: string | null; onPick: () => void }) {
  return (
    <button type="button" className="folder-chip" onClick={onPick} title={folder ? `Dossier de travail : ${folder}\nCliquer pour changer` : 'Choisir le dossier de travail'}>
      <Folder size={14} aria-hidden />
      <span>{folder ? folderLabel(folder) : 'Choisir un dossier'}</span>
      <ChevronDown size={12} aria-hidden />
    </button>
  );
}

interface Props {
  onNew: () => void;
  hour?: number;
  /** Zone de saisie : écrire démarre une conversation dans le dossier affiché. */
  composer?: ReactNode;
  recent?: RecentSession[];
  onOpenRecent?: (folder: string, id: string) => void;
}

/** Écran affiché quand aucune session n'est ouverte. */
export function Welcome({ onNew, hour = new Date().getHours(), composer, recent = [], onOpenRecent }: Props) {
  return (
    <main className="welcome">
      <Logo size={64} className="logo" />
      <h1>{greeting(hour)}, que fait-on ?</h1>
      {composer ? (
        <div className="welcome-composer">{composer}</div>
      ) : (
        <button className="welcome-new" onClick={onNew}>
          <Plus size={16} aria-hidden /> Nouvelle conversation
        </button>
      )}
      {recent.length > 0 && onOpenRecent && (
        <section className="welcome-recent" aria-label="Conversations récentes">
          <div className="welcome-recent-label">Récentes</div>
          <div className="welcome-recent-list">
            {recent.map((r) => (
              <button key={`${r.folder}/${r.id}`} type="button" className="recent-card" onClick={() => onOpenRecent(r.folder, r.id)} title={r.title}>
                <MessageSquare size={14} aria-hidden />
                <span className="recent-title">{r.title}</span>
                <span className="recent-meta">{r.meta}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <p className="welcome-hints">
        <span><kbd>Ctrl</kbd> <kbd>N</kbd> nouvelle conversation</span>
        <span><kbd>Ctrl</kbd> <kbd>K</kbd> rechercher</span>
        <span><kbd>Ctrl</kbd> <kbd>,</kbd> paramètres</span>
      </p>
    </main>
  );
}
