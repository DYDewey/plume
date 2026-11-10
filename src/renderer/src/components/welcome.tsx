import { Plus } from 'lucide-react';

/** « Bonjour » le jour, « Bonsoir » à partir de 18 h et la nuit. */
export function greeting(hour: number): string {
  return hour >= 5 && hour < 18 ? 'Bonjour' : 'Bonsoir';
}

/** Écran affiché quand aucune session n'est ouverte. */
export function Welcome({ onNew, hour = new Date().getHours() }: { onNew: () => void; hour?: number }) {
  return (
    <main className="welcome">
      <div className="logo" aria-hidden>C</div>
      <h1>{greeting(hour)}, que fait-on ?</h1>
      <button className="welcome-new" onClick={onNew}>
        <Plus size={16} aria-hidden /> Nouvelle conversation
      </button>
      <p className="welcome-hints">
        <span><kbd>Ctrl</kbd> <kbd>B</kbd> barre latérale</span>
        <span><kbd>Ctrl</kbd> <kbd>,</kbd> paramètres</span>
      </p>
    </main>
  );
}
