import { Settings } from 'lucide-react';

/** Barre de titre maison : on peut déplacer la fenêtre en la tirant ; Windows dessine ses boutons à droite. */
export function TitleBar({ onSettings, settingsOpen }: { onSettings: () => void; settingsOpen: boolean }) {
  return (
    <header className="titlebar">
      <span className="titlebar-logo" aria-hidden="true">C</span>
      <span className="titlebar-name">Mon-Claude</span>
      <span className="titlebar-spacer" />
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
