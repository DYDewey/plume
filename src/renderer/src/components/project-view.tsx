import { Paperclip, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { OrganizeData } from '../../../shared/organize';
import { MAX_INSTRUCTIONS, projectForCwd, type Project } from '../../../shared/projects';

interface Props {
  project: Project;
  /** Chemins (dossier ou fichiers) qui n'existent plus. */
  missing: ReadonlySet<string>;
  onChange: (patch: Partial<Omit<Project, 'folder'>>) => void;
  onPickFiles: () => Promise<string[]>;
  onNewSession: () => void;
  onDelete: () => void;
}

/** Barre du haut d'une session : rappelle que les instructions du projet sont envoyées. */
export function TopbarProject({ organize, cwd }: { organize: OrganizeData; cwd: string }) {
  const project = projectForCwd(organize, cwd)?.project;
  if (!project || (!project.instructions && !project.files?.length)) return null;
  return (
    <span className="topbar-project muted" title="Instructions et fichiers du projet envoyés à cette session">
      Projet : {project.name}
    </span>
  );
}

/** Nom à enregistrer à la sortie du champ ; null s'il est vide ou inchangé (le champ revient alors au nom actuel). */
export function nameChange(value: string, current: string): string | null {
  const name = value.trim();
  return name && name !== current ? name : null;
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

/** Fiche d'un projet. Nom et instructions sont enregistrés à la sortie du champ (le parent remonte la fiche avec `key`). */
export function ProjectView({ project, missing, onChange, onPickFiles, onNewSession, onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const files = project.files ?? [];
  const folderMissing = missing.has(project.folder);

  async function addFiles() {
    const picked = await onPickFiles();
    if (picked.length > 0) onChange({ files: [...files, ...picked] });
  }

  return (
    <main className="project-view">
      <header className="topbar project-head">
        <input
          className="project-name"
          aria-label="Nom du projet"
          defaultValue={project.name}
          onBlur={(e) => {
            const name = nameChange(e.target.value, project.name);
            if (name) onChange({ name });
            else e.target.value = project.name;
          }}
        />
        <button disabled={folderMissing} onClick={onNewSession}>
          <Plus size={14} aria-hidden /> Nouvelle conversation
        </button>
      </header>
      <div className="project-body">
        <p className="muted" title={project.folder}>
          Dossier : {project.folder}
          {folderMissing && <strong className="project-missing"> — Dossier introuvable</strong>}
        </p>

        <label className="project-label" htmlFor="project-instructions">
          Instructions
        </label>
        <textarea
          id="project-instructions"
          className="project-instructions"
          rows={8}
          maxLength={MAX_INSTRUCTIONS}
          defaultValue={project.instructions ?? ''}
          placeholder="Ex. : Explique simplement, je débute."
          onBlur={(e) => {
            if (e.target.value !== (project.instructions ?? '')) onChange({ instructions: e.target.value });
          }}
        />
        <p className="muted project-hint">
          Envoyées à chaque session lancée dans ce dossier. Une modification s'applique aux prochains lancements.
        </p>

        <div className="project-label">Fichiers de référence</div>
        {files.length > 0 && (
          <ul className="project-files">
            {files.map((file) => (
              <li key={file} className={missing.has(file) ? 'missing' : undefined} title={file}>
                <span className="sidebar-title">{fileName(file)}</span>
                <button
                  className="btn-icon"
                  aria-label={`Retirer ${fileName(file)}`}
                  title={`Retirer ${fileName(file)}`}
                  onClick={() => onChange({ files: files.filter((f) => f !== file) })}
                >
                  <X size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <button className="btn-secondary" onClick={() => void addFiles()}>
          <Paperclip size={14} aria-hidden /> Ajouter des fichiers
        </button>

        <div className="project-danger">
          {confirmDelete ? (
            <>
              <span>Supprimer la fiche ? Les sessions et les fichiers ne sont pas touchés.</span>
              <button className="btn-danger" onClick={onDelete}>
                Supprimer
              </button>
              <button className="btn-secondary" onClick={() => setConfirmDelete(false)}>
                Annuler
              </button>
            </>
          ) : (
            <button className="btn-secondary" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} aria-hidden /> Supprimer le projet
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
