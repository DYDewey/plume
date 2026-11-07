import { Check, CheckCheck, X } from 'lucide-react';
import type { ChatItem } from '../../../shared/chat-item';
import type { PermissionDecision } from '../../../shared/events';
import { fullToolTarget, ToolIcon } from './tool-line';

const ANSWERED: Record<PermissionDecision, string> = {
  allow: 'autorisé',
  always: 'toujours autorisé',
  deny: 'refusé',
};

interface Props {
  item: Extract<ChatItem, { kind: 'permission' }>;
  onAnswer?: (requestId: string, decision: PermissionDecision) => void;
}

/** Demande de permission : trois boutons tant qu'elle attend, une ligne une fois répondue. */
export function PermissionCard({ item, onAnswer }: Props) {
  if (item.decision) {
    return (
      <div className="msg msg-tool">
        <ToolIcon name={item.toolName} /> <strong>{item.toolName}</strong> {ANSWERED[item.decision]}
      </div>
    );
  }
  const target = fullToolTarget(item.input);
  return (
    <div className="msg permission-card">
      <div className="permission-title">
        <ToolIcon name={item.toolName} /> Claude demande à utiliser <strong>{item.toolName}</strong>
      </div>
      {/* La commande exacte d'abord : la description est écrite par Claude, elle ne suffit pas pour décider. */}
      {target && <pre className="permission-target">{target}</pre>}
      {item.description && item.description !== target && <div className="muted">{item.description}</div>}
      <details className="msg-tool">
        <summary>Détails</summary>
        <pre>{JSON.stringify(item.input, null, 2)}</pre>
      </details>
      <div className="permission-actions">
        <button onClick={() => onAnswer?.(item.requestId, 'allow')}>
          <Check size={14} aria-hidden /> Autoriser
        </button>
        {item.rules.length > 0 && (
          <button className="btn-secondary" onClick={() => onAnswer?.(item.requestId, 'always')}>
            <CheckCheck size={14} aria-hidden /> Toujours autoriser
          </button>
        )}
        <button className="btn-secondary" onClick={() => onAnswer?.(item.requestId, 'deny')}>
          <X size={14} aria-hidden /> Refuser
        </button>
      </div>
      {item.rules.length > 0 && (
        <div className="permission-rule muted">« Toujours » enregistre dans ce dossier : {item.rules.join(', ')}</div>
      )}
    </div>
  );
}
