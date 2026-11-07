import { CircleStop, TriangleAlert } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ChatItem } from '../../../shared/chat-item';
import type { PermissionDecision } from '../../../shared/events';
import { Markdown } from './message';
import { PermissionCard } from './permission-card';
import { ToolLine } from './tool-line';

interface Props {
  items: ChatItem[];
  running: boolean;
  /** Message à montrer et surligner (résultat de recherche) ; sinon on descend en bas. */
  focusIndex?: number;
  onPermission?: (requestId: string, decision: PermissionDecision) => void;
}

export function ChatView({ items, running, focusIndex, onPermission }: Props) {
  const bottom = useRef<HTMLDivElement>(null);
  const found = useRef<HTMLDivElement>(null);
  // Claude n'a encore rien écrit depuis le dernier message : on le dit, le démarrage prend ~35 s.
  const waiting = running && items.at(-1)?.kind === 'user';
  const mark = (i: number) => (i === focusIndex ? ' msg-found' : '');

  // Accolades obligatoires : scrollIntoView renvoie une Promise dans Electron 45, et React
  // prendrait toute valeur renvoyée pour une fonction de nettoyage (plantage « destroy_ is not a function »).
  useEffect(() => {
    if (found.current) {
      found.current.scrollIntoView({ block: 'center' });
    } else {
      bottom.current?.scrollIntoView({ block: 'end' });
    }
  }, [items, focusIndex]);

  return (
    <div className="chat">
      {items.map((item, i) => {
        switch (item.kind) {
          case 'user':
            return <div key={i} ref={i === focusIndex ? found : undefined} className={`msg msg-user${mark(i)}`}>{item.text}</div>;
          case 'assistant':
            return (
              <div key={i} ref={i === focusIndex ? found : undefined} className={`msg msg-claude${mark(i)}`}>
                <Markdown text={item.text} />
              </div>
            );
          case 'tool':
            return <ToolLine key={i} name={item.name} input={item.input} />;
          case 'permission':
            return <PermissionCard key={item.requestId} item={item} onAnswer={onPermission} />;
          case 'stopped':
            return <div key={i} className="msg muted"><CircleStop size={14} aria-hidden /> Réponse arrêtée</div>;
          case 'error':
            return <div key={i} className="msg msg-error"><TriangleAlert size={14} aria-hidden /> {item.message}</div>;
        }
      })}
      {waiting && <div className="msg msg-claude muted">Claude démarre…</div>}
      <div ref={bottom} />
    </div>
  );
}
