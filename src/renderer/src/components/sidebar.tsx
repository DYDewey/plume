import { PanelLeft, Plus, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Limits, SessionState } from '../state/sessions';
import { ContextBadge, UsageGauges } from './usage-gauges';

interface Props {
  sessions: SessionState[];
  activeId: string | null;
  limits?: Limits;
  onNew: () => void;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  /** Repliée : il ne reste qu'une fine colonne avec « déplier » et « nouvelle session ». */
  collapsed: boolean;
  onToggle: () => void;
  /** Placé entre les sessions en cours et les jauges (l'historique). */
  children?: ReactNode;
  /** Sous les jauges (réglages). */
  footer?: ReactNode;
}

export function Sidebar({ sessions, activeId, limits, onNew, onSelect, onClose, collapsed, onToggle, children, footer }: Props) {
  if (collapsed) {
    return (
      <nav className="sidebar collapsed">
        <button className="btn-icon" onClick={onToggle} aria-label="Déplier la barre latérale" aria-expanded={false} title="Déplier (Ctrl+B)">
          <PanelLeft size={18} aria-hidden />
        </button>
        <button className="btn-icon" onClick={onNew} aria-label="Nouvelle session" title="Nouvelle session">
          <Plus size={18} aria-hidden />
        </button>
      </nav>
    );
  }
  return (
    <nav className="sidebar">
      <div className="sidebar-top">
        <button className="btn-secondary new-session" onClick={onNew}>
          <Plus size={16} aria-hidden /> Nouvelle session
        </button>
        <button className="btn-icon" onClick={onToggle} aria-label="Replier la barre latérale" aria-expanded title="Replier (Ctrl+B)">
          <PanelLeft size={18} aria-hidden />
        </button>
      </div>
      <div className="sidebar-section">En cours</div>
      <ul>
        {sessions.map((s) => (
          <li
            key={s.id}
            className={s.id === activeId ? 'active' : undefined}
            onClick={() => onSelect(s.id)}
            title={s.cwd}
          >
            {/* Point plein qui pulse = Claude répond ; anneau = réponse arrivée pendant que la session était cachée. */}
            <span className={`indicator ${s.status === 'running' ? 'running' : s.unread ? 'unread' : ''}`} />
            <span className="sidebar-title">{s.title}</span>
            <ContextBadge context={s.context} />
            <button
              className="btn-icon close"
              aria-label="Fermer la session"
              title="Fermer la session"
              onClick={(e) => {
                e.stopPropagation(); // sinon le clic sélectionne aussi la session
                onClose(s.id);
              }}
            >
              <X size={14} aria-hidden />
            </button>
          </li>
        ))}
        {sessions.length === 0 && <li className="muted sidebar-none">Aucune session ouverte</li>}
      </ul>
      {children}
      <UsageGauges limits={limits} />
      {footer}
    </nav>
  );
}
