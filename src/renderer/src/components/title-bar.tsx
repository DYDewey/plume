import { ArrowDownToLine, LoaderCircle, Settings } from 'lucide-react';
import { Logo } from './logo';

/** Nouvelle version prête à installer (et progression du téléchargement une fois lancée). */
export interface UpdateBadge {
  version: string;
  /** De 0 à 1 pendant le téléchargement ; absent avant. */
  progress?: number;
  /** Une réponse est en cours : on n'interrompt pas Claude. */
  blocked?: boolean;
}

/** Barre de titre maison : on peut déplacer la fenêtre en la tirant ; Windows dessine ses boutons à droite. */
export function TitleBar({
  onSettings,
  settingsOpen,
  update,
  onUpdate,
}: {
  onSettings: () => void;
  settingsOpen: boolean;
  update?: UpdateBadge;
  onUpdate?: () => void;
}) {
  const downloading = update?.progress !== undefined;
  return (
    <header className="titlebar">
      <Logo size={22} className="titlebar-logo" />
      <span className="titlebar-name">Plume</span>
      <span className="titlebar-spacer" />
      {update && (
        <button
          type="button"
          className="update-pill"
          onClick={onUpdate}
          disabled={downloading || update.blocked}
          title={
            update.blocked
              ? 'Attends la fin de la réponse de Claude pour mettre à jour'
              : `Installer Plume ${update.version} : l'app se ferme et se relance toute seule`
          }
        >
          {downloading ? <LoaderCircle size={14} className="spin" aria-hidden /> : <ArrowDownToLine size={14} aria-hidden />}
          {downloading ? `Téléchargement ${Math.round((update.progress ?? 0) * 100)} %` : `Mettre à jour (${update.version})`}
        </button>
      )}
      <button
        type="button"
        className={settingsOpen ? 'btn-icon titlebar-btn on' : 'btn-icon titlebar-btn'}
        onClick={onSettings}
        aria-label="Paramètres"
        aria-pressed={settingsOpen}
        title="Paramètres (Ctrl+,)"
      >
        <Settings size={16} aria-hidden />
      </button>
    </header>
  );
}
