import { BookOpen, Play, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import type { ChatItem } from '../../../shared/chat-item';
import { folderLabel } from '../ui-format';
import { ChatView } from './chat-view';
import { FavoriteButton } from './favorite-button';
import { RenameButton, RenameField } from './rename-field';

interface Props {
  title: string;
  path?: string;
  /** Absent tant que la session est en cours de lecture. */
  items?: ChatItem[];
  error?: string;
  favorite?: boolean;
  /** Absents : pas d'étoile ni de crayon dans l'en-tête. */
  onToggleFavorite?: () => void;
  onRename?: (title: string) => void;
  /** Message trouvé par la recherche : on y défile et on le surligne. */
  focusIndex?: number;
  /** Absent : pas de bouton « Continuer ». */
  onContinue?: () => void;
  /** Le dossier de la session n'existe plus : impossible de continuer. */
  folderMissing?: boolean;
}

/** Nom du dossier à côté du titre (chemin complet en infobulle), sauf s'il répète le titre. */
export function TopbarFolder({ title, path }: { title: string; path: string }) {
  const label = folderLabel(path);
  if (label === title) return null;
  return (
    <span className="topbar-folder" title={path}>
      {label}
    </span>
  );
}

// Ancienne session relue depuis ~/.claude/projects/ : même affichage que le chat, sans zone de saisie.
export function HistoryView({ title, path, items, error, favorite = false, onToggleFavorite, onRename, focusIndex, onContinue, folderMissing = false }: Props) {
  const [editing, setEditing] = useState(false);
  return (
    <main className="session">
      <header className="topbar">
        {editing && onRename ? (
          <RenameField
            initial={title}
            onSave={(name) => {
              setEditing(false);
              onRename(name);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <span className="topbar-title">
            {title}
            {path && <TopbarFolder title={title} path={path} />}
          </span>
        )}
        {onRename && !editing && <RenameButton onClick={() => setEditing(true)} />}
        {onToggleFavorite && <FavoriteButton on={favorite} onToggle={onToggleFavorite} />}
        <span className="readonly"><BookOpen size={14} aria-hidden /> Lecture seule</span>
        {onContinue && (
          <button
            className="btn-secondary btn-continue"
            onClick={onContinue}
            disabled={folderMissing || !items}
            title={folderMissing ? 'Dossier introuvable' : 'Reprendre dans une copie : cette conversation reste intacte'}
          >
            <Play size={14} aria-hidden /> Continuer
          </button>
        )}
      </header>
      {error ? (
        <div className="chat">
          <div className="msg msg-error"><TriangleAlert size={14} aria-hidden /> {error}</div>
        </div>
      ) : items ? (
        <ChatView items={items} running={false} focusIndex={focusIndex} />
      ) : (
        <div className="chat">
          <div className="msg muted">Chargement…</div>
        </div>
      )}
    </main>
  );
}
