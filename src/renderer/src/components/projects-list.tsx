import { ChevronDown, ChevronRight, FolderKanban, FolderPlus, Plus } from 'lucide-react';
import { useState } from 'react';
import type { HistoryProject } from '../../../shared/history';
import { displayTitle, sessionKey, type OrganizeData } from '../../../shared/organize';
import { projectSessions } from '../../../shared/projects';
import { FavoriteButton } from './favorite-button';

interface Props {
  history: HistoryProject[];
  organize: OrganizeData;
  openKey?: string;
  /** Projet dont la fiche est affichée. */
  openProjectId?: string;
  /** Dossiers qui n'existent plus. */
  missing: ReadonlySet<string>;
  onOpen: (folder: string, id: string) => void;
  onOpenProject: (id: string) => void;
  onToggleFavorite: (key: string) => void;
  onNewProject: () => void;
  onNewSession: (folder: string) => void;
}

/** Section « Projets » : un clic ouvre la fiche, la flèche déplie les sessions, « + » lance une session dans le dossier. */
export function ProjectsList({
  history,
  organize,
  openKey,
  openProjectId,
  missing,
  onOpen,
  onOpenProject,
  onToggleFavorite,
  onNewProject,
  onNewSession,
}: Props) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const projects = Object.entries(organize.projects ?? {}).sort(([, a], [, b]) => a.name.localeCompare(b.name));

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  return (
    <section className="projects">
      <div className="history-head">
        <span>Projets</span>
        <button className="btn-icon" aria-label="Nouveau projet" title="Nouveau projet" onClick={onNewProject}>
          <FolderPlus size={14} aria-hidden />
        </button>
      </div>
      {projects.length > 0 && (
        <ul>
          {projects.map(([id, project]) => {
            const sessions = projectSessions(history, project);
            const active = openProjectId === id;
            // Comme l'historique : déplié d'office si sa fiche ou une de ses sessions est affichée.
            const open =
              expanded.has(id) ||
              active ||
              sessions.some((e) => openKey === sessionKey(e.project.folder, e.session.id));
            const folderMissing = missing.has(project.folder);
            const newLabel = `Nouvelle conversation dans « ${project.name} »`;
            const rowClass = ['project-row', active && 'active', folderMissing && 'missing'].filter(Boolean).join(' ');
            return (
              <li key={id} className="project-item">
                <div
                  className={rowClass}
                  onClick={() => onOpenProject(id)}
                  title={folderMissing ? `Dossier introuvable : ${project.folder}` : project.folder}
                >
                  <button
                    className="btn-icon project-toggle"
                    aria-label={open ? 'Replier' : 'Déplier'}
                    aria-expanded={open}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(id);
                    }}
                  >
                    {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
                  </button>
                  <FolderKanban size={14} aria-hidden />
                  <span className="sidebar-title">{project.name}</span>
                  <span className="muted">({sessions.length})</span>
                  <button
                    className="btn-icon project-new"
                    disabled={folderMissing}
                    aria-label={newLabel}
                    title={newLabel}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNewSession(project.folder);
                    }}
                  >
                    <Plus size={14} aria-hidden />
                  </button>
                </div>
                {open && (
                  <ul className="project-sessions">
                    {sessions.map(({ project: entry, session }) => {
                      const key = sessionKey(entry.folder, session.id);
                      const title = displayTitle(session, organize.sessions[key]);
                      return (
                        <li
                          key={key}
                          className={openKey === key ? 'active' : undefined}
                          onClick={() => onOpen(entry.folder, session.id)}
                          title={title}
                        >
                          <span className="sidebar-title">{title}</span>
                          <FavoriteButton
                            on={!!organize.sessions[key]?.favorite}
                            onToggle={() => onToggleFavorite(key)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
