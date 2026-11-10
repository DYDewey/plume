import { CircleStop, TriangleAlert } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { ChatItem } from '../../../shared/chat-item';
import type { PermissionDecision } from '../../../shared/events';
import { fileChanges, turnRanges, type FileChange } from '../../../shared/file-changes';
import { FilesCard } from './files-card';
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
  // Fichiers modifiés par chaque réponse terminée, affichés sous son dernier élément.
  const changesAfter = useMemo(() => {
    const map = new Map<number, FileChange[]>();
    for (const [start, end] of turnRanges(items)) {
      if (end === items.length && running) continue; // réponse en cours : la carte viendra à la fin
      const changes = fileChanges(items.slice(start, end));
      if (changes.length) map.set(end - 1, changes);
    }
    return map;
  }, [items, running]);
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

  function renderItem(item: ChatItem, i: number): ReactNode {
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
  }

  return (
    <div className="chat">
      <div className="chat-column">
      {items.map((item, i) => {
        const changes = changesAfter.get(i);
        const el = renderItem(item, i);
        return changes ? <Fragment key={`f${i}`}>{el}<FilesCard changes={changes} /></Fragment> : el;
      })}
      {waiting && (
        <div className="msg thinking" role="status" aria-label="Claude réfléchit">
          <span className="thinking-dots" aria-hidden><i /><i /><i /></span> Claude réfléchit…
        </div>
      )}
      <div ref={bottom} />
      </div>
    </div>
  );
}
