import { ArrowUp, NotebookTabs, Paperclip, Square, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import { addAttachments, canSend, droppedPaths, fileName, imageExt, isImagePath, withAttachments } from '../../../shared/attachments';
import type { SendKey } from '../../../shared/settings';
import type { SavedPrompt } from '../../../shared/prompts';
import { PromptsPanel } from './prompts-panel';
import { matchCommands, SlashMenu } from './slash-menu';

interface Props {
  running: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  /** Ouvre la boîte de dialogue Windows ; renvoie les chemins choisis (vide si annulé). */
  onPickFiles: () => Promise<string[]>;
  /** Chemin sur le disque d'un fichier glissé-déposé ('' si ce n'en est pas un). */
  pathForFile: (file: File) => string;
  /** Enregistre une image collée et renvoie son chemin. */
  onSavePasted: (bytes: Uint8Array, ext: string) => Promise<string>;
  /** Noms des commandes et skills proposés après « / ». */
  commands: string[];
  /** Contrôles affichés à côté du trombone (menu du modèle). */
  tools?: ReactNode;
  /** Prochain message proposé par claude : affiché en gris, Tab le recopie. */
  suggestion?: string;
  /** Réglage : Entrée envoie (Maj+Entrée = ligne), ou Ctrl+Entrée envoie (Entrée = ligne). */
  sendKey?: SendKey;
  /** Modèles de messages enregistrés (panneau des prompts) ; absent : pas de panneau. */
  prompts?: SavedPrompt[];
  onSavePrompt?: (text: string) => void;
  onDeletePrompt?: (id: string) => void;
  /** Miniature d'une image jointe (data URL), ou null. */
  thumbnail?: (path: string) => Promise<string | null>;
}

/** Vrai si cette touche doit envoyer le message. */
export function isSendKey(e: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey'>, sendKey: SendKey): boolean {
  if (e.key !== 'Enter') return false;
  return sendKey === 'ctrl-enter' ? e.ctrlKey : !e.shiftKey && !e.ctrlKey;
}

/** Miniature d'une image jointe, demandée à main ; rien tant qu'elle n'est pas prête (ou si ce n'est pas une image). */
function Thumb({ path, thumbnail }: { path: string; thumbnail?: (path: string) => Promise<string | null> }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!thumbnail || !isImagePath(path)) return;
    let stale = false;
    thumbnail(path).then(
      (url) => {
        if (!stale) setSrc(url);
      },
      () => {},
    );
    return () => {
      stale = true;
    };
  }, [path, thumbnail]);
  return src ? <img className="attachment-thumb" src={src} alt="" /> : null;
}

export function AttachmentChips({ files, onRemove, thumbnail }: { files: string[]; onRemove: (path: string) => void; thumbnail?: (path: string) => Promise<string | null> }) {
  if (files.length === 0) return null;
  return (
    <div className="attachments">
      {files.map((path) => (
        <span key={path} className="attachment" title={path}>
          <Thumb path={path} thumbnail={thumbnail} />
          {fileName(path)}
          <button onClick={() => onRemove(path)} aria-label={`Retirer ${fileName(path)}`} title="Retirer">
            <X size={12} aria-hidden />
          </button>
        </span>
      ))}
    </div>
  );
}

export function Composer({ running, onSend, onStop, onPickFiles, pathForFile, onSavePasted, commands, suggestion, tools, sendKey = 'enter', prompts, onSavePrompt, onDeletePrompt, thumbnail }: Props) {
  const [panel, setPanel] = useState(false);
  const closePanel = useCallback(() => setPanel(false), []);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState(0);
  const [menuClosed, setMenuClosed] = useState(false);
  const matches = menuClosed ? [] : matchCommands(text, commands);
  // La zone de saisie grandit avec le texte (plafond en CSS : max-height), puis défile.
  const area = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const t = area.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${t.scrollHeight}px`;
  }, [text]);

  function change(value: string) {
    setText(value);
    setSelected(0);
    setMenuClosed(false);
  }

  /** Panneau des prompts : une commande se met devant le texte, un modèle s'ajoute à la suite. */
  function insert(snippet: string) {
    setPanel(false);
    if (snippet.startsWith('/')) change(snippet + text.replace(/^\/\S+\s*/, ''));
    else change(text.trim() ? `${text.replace(/\s+$/, '')}\n${snippet}` : snippet);
    requestAnimationFrame(() => {
      const t = area.current;
      if (!t) return;
      t.focus();
      t.setSelectionRange(t.value.length, t.value.length);
    });
  }

  function pick(name: string) {
    change(`/${name} `);
  }

  function submit() {
    if (!canSend(text, files) || running) return;
    onSend(withAttachments(text, files));
    setText('');
    setFiles([]);
  }

  async function pickFiles() {
    const picked = await onPickFiles();
    setFiles((current) => addAttachments(current, picked));
  }

  function onDragOver(e: DragEvent) {
    if (running || !e.dataTransfer.types.includes('Files')) return;
    e.preventDefault(); // sinon le navigateur refuse le dépôt
    setDragging(true);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (running) return;
    const dropped = droppedPaths([...e.dataTransfer.files], pathForFile);
    setFiles((current) => addAttachments(current, dropped));
  }

  // Fichier copié dans l'Explorateur : on prend son chemin. Capture d'écran : on l'enregistre d'abord.
  // Sans fichier dans le presse-papiers, le collage de texte se fait normalement.
  async function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = [...e.clipboardData.files];
    if (pasted.length === 0) return;
    e.preventDefault();
    const paths: string[] = [];
    for (const file of pasted) {
      const path = pathForFile(file);
      const ext = imageExt(file.type);
      if (path) paths.push(path);
      else if (ext) paths.push(await onSavePasted(new Uint8Array(await file.arrayBuffer()), ext));
    }
    setFiles((current) => addAttachments(current, paths));
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Tab' && !text && suggestion) {
      e.preventDefault();
      change(suggestion);
      return;
    }
    if (matches.length > 0) {
      const move = { ArrowDown: 1, ArrowUp: -1 }[e.key];
      if (move) {
        e.preventDefault();
        setSelected((selected + move + matches.length) % matches.length);
        return;
      }
      if (e.key === 'Escape') {
        setMenuClosed(true);
        return;
      }
      // Tab ou Entrée complète le nom ; Entrée sur un nom déjà complet envoie directement.
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey && text.slice(1) !== matches[selected])) {
        e.preventDefault();
        pick(matches[selected]);
        return;
      }
    }
    // Selon le réglage : Entrée ou Ctrl+Entrée envoie ; l'autre combinaison fait un saut de ligne.
    if (isSendKey(e, sendKey)) {
      e.preventDefault();
      submit();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      // Ctrl+Entrée n'insère rien tout seul dans un textarea : on ajoute la ligne nous-mêmes.
      e.preventDefault();
      const t = e.currentTarget;
      const at = t.selectionStart;
      change(text.slice(0, at) + '\n' + text.slice(t.selectionEnd));
      requestAnimationFrame(() => t.setSelectionRange(at + 1, at + 1));
    }
  }

  return (
    <div className="composer-dock">
      <div
        className={dragging ? 'composer dragging' : 'composer'}
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {panel && prompts && onSavePrompt && onDeletePrompt && (
          <PromptsPanel
            prompts={prompts}
            commands={commands}
            draft={text}
            onInsert={insert}
            onSave={onSavePrompt}
            onDelete={onDeletePrompt}
            onClose={closePanel}
          />
        )}
        {matches.length > 0 && <SlashMenu items={matches} selected={selected} onPick={pick} />}
        <AttachmentChips files={files} thumbnail={thumbnail} onRemove={(path) => setFiles((current) => current.filter((p) => p !== path))} />
        <textarea
          ref={area}
          value={text}
          onChange={(e) => change(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          disabled={running}
          placeholder={
            running ? 'Claude répond…' : suggestion ? `${suggestion}   (Tab pour reprendre)` : `Écris ton message (${sendKey === 'ctrl-enter' ? 'Ctrl+Entrée' : 'Entrée'} pour envoyer)`
          }
          rows={1}
          autoFocus
        />
        <div className="composer-bar">
          <button className="btn-icon" onClick={pickFiles} disabled={running} title="Joindre des fichiers" aria-label="Joindre des fichiers">
            <Paperclip size={18} aria-hidden />
          </button>
          {prompts && (
            <button className={panel ? 'btn-icon prompts-toggle on' : 'btn-icon prompts-toggle'} onClick={() => setPanel((o) => !o)} disabled={running}
              title="Prompts et skills" aria-label="Prompts et skills" aria-expanded={panel}>
              <NotebookTabs size={18} aria-hidden />
            </button>
          )}
          {tools}
          <span className="composer-spacer" />
          {running ? (
            <button className="send-btn stop" onClick={onStop} aria-label="Arrêter la réponse" title="Arrêter">
              <Square size={14} aria-hidden fill="currentColor" />
            </button>
          ) : (
            <button className="send-btn" onClick={submit} disabled={!canSend(text, files)} aria-label="Envoyer" title="Envoyer">
              <ArrowUp size={18} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
