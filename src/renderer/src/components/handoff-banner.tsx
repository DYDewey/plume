import { NotebookPen, X } from 'lucide-react';

/** Bandeau au-dessus de la saisie : le contexte est presque plein, on propose de repartir d'un résumé. */
export function HandoffBanner({ percent, onHandoff, onDismiss }: { percent: number; onHandoff: () => void; onDismiss: () => void }) {
  return (
    <div className="handoff-banner" role="status">
      <NotebookPen size={16} aria-hidden />
      <span className="handoff-banner-text">
        <strong>Contexte à {percent} %.</strong> Une passation repart d'un résumé : Claude reste précis et ton quota dure plus longtemps.
      </span>
      <button type="button" onClick={onHandoff}>Faire la passation</button>
      <button type="button" className="btn-icon" onClick={onDismiss} aria-label="Ne plus proposer pour cette conversation" title="Plus tard">
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
