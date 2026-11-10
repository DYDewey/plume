import { ChevronDown, ChevronUp, CircleStop, Pencil, RotateCcw, Search, TriangleAlert, X } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ChatItem } from '../../../shared/chat-item';
import type { PermissionDecision } from '../../../shared/events';
import { fileChanges, turnRanges, type FileChange } from '../../../shared/file-changes';
import { findMatches, occurrences, stepMatch } from '../find';
import { FilesCard } from './files-card';
import { CopyButton, Markdown } from './message';
import { PermissionCard } from './permission-card';
import { ToolLine } from './tool-line';

interface Props {
  items: ChatItem[];
  running: boolean;
  /** Message à montrer et surligner (résultat de recherche) ; sinon on descend en bas. */
  focusIndex?: number;
  onPermission?: (requestId: string, decision: PermissionDecision) => void;
  /** Renvoie le dernier message (bouton « Réessayer » sous la dernière réponse) ; absent : pas de bouton. */
  onRetry?: () => void;
  /** Modifier un message déjà envoyé : la conversation repart de là avec le nouveau texte. Absent : pas de bouton. */
  onEdit?: (index: number, text: string) => void;
}

/** Zone d'édition d'un message envoyé : Entrée envoie, Maj+Entrée va à la ligne, Échap annule. */
function EditBox({ initial, onSave, onCancel }: { initial: string; onSave: (text: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(initial);
  const save = () => {
    if (text.trim()) onSave(text.trim());
  };
  return (
    <div className="msg-edit">
      <textarea
        value={text}
        autoFocus
        rows={Math.min(10, text.split('\n').length + 1)}
        aria-label="Modifier le message"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            save();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      <div className="msg-edit-bar">
        <span className="muted">La conversation repartira de ce message ; la suite actuelle reste dans l'historique.</span>
        <button type="button" className="btn-secondary" onClick={onCancel}>Annuler</button>
        <button type="button" onClick={save} disabled={!text.trim()}>Envoyer</button>
      </div>
    </div>
  );
}

/** Ctrl+F seul (sans Maj, Alt ni Windows). */
export function isFindShortcut(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'>): boolean {
  return e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'f';
}

const HL_ALL = 'find-all';
const HL_CURRENT = 'find-current';

/** Surligne la recherche dans les messages trouvés (API CSS Custom Highlight : le DOM de React n'est pas touché). */
function paintHighlights(root: HTMLElement | null, indices: number[], current: number, query: string): void {
  if (typeof CSS === 'undefined' || !('highlights' in CSS) || typeof Highlight === 'undefined') return;
  CSS.highlights.delete(HL_ALL);
  CSS.highlights.delete(HL_CURRENT);
  if (!root || indices.length === 0) return;
  const all: Range[] = [];
  const cur: Range[] = [];
  indices.forEach((index, k) => {
    const el = root.querySelector(`[data-i="${index}"]`);
    if (!el) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (const [start, end] of occurrences(node.textContent ?? '', query)) {
        const r = document.createRange();
        r.setStart(node, start);
        r.setEnd(node, end);
        (k === current ? cur : all).push(r);
      }
    }
  });
  CSS.highlights.set(HL_ALL, new Highlight(...all));
  CSS.highlights.set(HL_CURRENT, new Highlight(...cur));
}

export function ChatView({ items, running, focusIndex, onPermission, onRetry, onEdit }: Props) {
  /** Index du message en cours de modification. */
  const [editing, setEditing] = useState<number | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const found = useRef<HTMLDivElement>(null);
  const column = useRef<HTMLDivElement>(null);
  const findInput = useRef<HTMLInputElement>(null);
  // Recherche dans la conversation (Ctrl+F).
  const [find, setFind] = useState({ open: false, query: '', at: 0 });
  const matches = useMemo(() => (find.open ? findMatches(items, find.query) : []), [items, find.open, find.query]);
  const at = Math.min(find.at, Math.max(0, matches.length - 1));
  const searching = find.open && find.query.trim() !== '';
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
  // « Réessayer » sous le dernier élément (réponse, erreur ou arrêt), une fois Claude au repos.
  const retryAt = onRetry && !running && items.some((i) => i.kind === 'user') && items.at(-1)?.kind !== 'user' ? items.length - 1 : -1;
  const mark = (i: number) => (i === focusIndex ? ' msg-found' : '');

  // Accolades obligatoires : scrollIntoView renvoie une Promise dans Electron 45, et React
  // prendrait toute valeur renvoyée pour une fonction de nettoyage (plantage « destroy_ is not a function »).
  useEffect(() => {
    if (searching) return; // on reste sur le résultat affiché
    if (found.current) {
      found.current.scrollIntoView({ block: 'center' });
    } else {
      bottom.current?.scrollIntoView({ block: 'end' });
    }
  }, [items, focusIndex, searching]);

  // Ctrl+F ouvre la recherche (ou resélectionne le texte si elle est déjà ouverte).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isFindShortcut(e)) return;
      e.preventDefault();
      setFind((f) => ({ ...f, open: true }));
      requestAnimationFrame(() => findInput.current?.select());
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // Résultat courant : on y défile, et la recherche est surlignée dans le texte.
  useEffect(() => {
    paintHighlights(column.current, searching ? matches : [], at, find.query);
    if (searching && matches.length) {
      column.current?.querySelector(`[data-i="${matches[at]}"]`)?.scrollIntoView({ block: 'center' });
    }
  }, [matches, at, searching, find.query]);
  useEffect(() => () => paintHighlights(null, [], 0, ''), []);

  function closeFind() {
    setFind({ open: false, query: '', at: 0 });
  }

  function renderItem(item: ChatItem, i: number): ReactNode {
    const hit = searching && matches.includes(i) ? (matches[at] === i ? ' msg-match current' : ' msg-match') : '';
    switch (item.kind) {
      case 'user':
        if (editing === i && onEdit) {
          return (
            <EditBox
              key={i}
              initial={item.text}
              onCancel={() => setEditing(null)}
              onSave={(text) => {
                setEditing(null);
                onEdit(i, text);
              }}
            />
          );
        }
        return (
          <div key={i} className="msg-turn user">
            <div data-i={i} ref={i === focusIndex ? found : undefined} className={`msg msg-user${mark(i)}${hit}`}>{item.text}</div>
            {onEdit && !running && (
              <div className="msg-tools">
                <button type="button" className="btn-icon msg-copy" onClick={() => setEditing(i)} aria-label="Modifier ce message" title="Modifier et renvoyer">
                  <Pencil size={14} aria-hidden /> <span>Modifier</span>
                </button>
              </div>
            )}
          </div>
        );
      case 'assistant':
        return (
          <div key={i} className="msg-turn">
            <div data-i={i} ref={i === focusIndex ? found : undefined} className={`msg msg-claude${mark(i)}${hit}`}>
              <Markdown text={item.text} />
            </div>
            {/* Pas pendant que Claude écrit encore ce message. */}
            {!(running && i === items.length - 1) && (
              <div className="msg-tools">
                <CopyButton text={item.text} what="la réponse" className="msg-copy" />
              </div>
            )}
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
      {find.open && (
        <div className="find-bar" role="search">
          <Search size={14} aria-hidden />
          <input
            ref={findInput}
            type="search"
            value={find.query}
            autoFocus
            placeholder="Rechercher dans la conversation"
            aria-label="Rechercher dans la conversation"
            onChange={(e) => setFind((f) => ({ ...f, query: e.target.value, at: 0 }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                setFind((f) => ({ ...f, at: stepMatch(at, matches.length, e.shiftKey ? -1 : 1) }));
              } else if (e.key === 'Escape') {
                e.preventDefault();
                closeFind();
              }
            }}
          />
          <span className="find-count" aria-live="polite">
            {searching ? (matches.length ? `${at + 1} / ${matches.length}` : 'Aucun') : ''}
          </span>
          <button type="button" className="btn-icon" aria-label="Résultat précédent" title="Précédent (Maj+Entrée)" disabled={matches.length < 2}
            onClick={() => setFind((f) => ({ ...f, at: stepMatch(at, matches.length, -1) }))}>
            <ChevronUp size={16} aria-hidden />
          </button>
          <button type="button" className="btn-icon" aria-label="Résultat suivant" title="Suivant (Entrée)" disabled={matches.length < 2}
            onClick={() => setFind((f) => ({ ...f, at: stepMatch(at, matches.length, 1) }))}>
            <ChevronDown size={16} aria-hidden />
          </button>
          <button type="button" className="btn-icon" aria-label="Fermer la recherche" title="Fermer (Échap)" onClick={closeFind}>
            <X size={16} aria-hidden />
          </button>
        </div>
      )}
      <div className="chat-column" ref={column}>
      {items.map((item, i) => {
        const changes = changesAfter.get(i);
        const el = renderItem(item, i);
        const retry = i === retryAt && (
          <div className="msg-actions" key={`r${i}`}>
            <button type="button" className="btn-secondary retry-btn" onClick={onRetry} title="Renvoyer ton dernier message">
              <RotateCcw size={14} aria-hidden /> Réessayer
            </button>
          </div>
        );
        return changes || retry ? <Fragment key={`f${i}`}>{el}{changes && <FilesCard changes={changes} />}{retry}</Fragment> : el;
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
