import { BookmarkPlus, Puzzle, Search, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { filterPrompts, type SavedPrompt } from '../../../shared/prompts';

interface Props {
  prompts: SavedPrompt[];
  commands: string[];
  /** Texte actuel de la saisie (pour « Enregistrer comme modèle »). */
  draft: string;
  onInsert: (text: string) => void;
  onSave: (text: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

/** Panneau au-dessus de la saisie : modèles de messages enregistrés et skills / commandes de Claude. */
export function PromptsPanel({ prompts, commands, draft, onInsert, onSave, onDelete, onClose }: Props) {
  const [tab, setTab] = useState<'prompts' | 'skills'>('prompts');
  const [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const shownPrompts = filterPrompts(prompts, query);
  const shownSkills = filterPrompts(commands.map((c) => ({ title: c })), query);

  // Clic hors du panneau ou Échap : fermé.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!root.current?.contains(target) && !target.closest('.prompts-toggle')) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="prompts-panel" ref={root} role="dialog" aria-label="Prompts et skills">
      <div className="prompts-top">
        <div className="segmented" role="radiogroup" aria-label="Liste">
          <button type="button" role="radio" aria-checked={tab === 'prompts'} className={tab === 'prompts' ? 'on' : undefined} onClick={() => setTab('prompts')}>
            Mes modèles
          </button>
          <button type="button" role="radio" aria-checked={tab === 'skills'} className={tab === 'skills' ? 'on' : undefined} onClick={() => setTab('skills')}>
            Skills et commandes
          </button>
        </div>
        <label className="search prompts-search">
          <Search size={14} aria-hidden />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrer" aria-label="Filtrer" autoFocus />
        </label>
      </div>
      <ul className="prompts-list">
        {tab === 'prompts' ? (
          <>
            {shownPrompts.map((p) => (
              <li key={p.id}>
                <button type="button" className="prompt-item" onClick={() => onInsert(p.text)} title={p.text}>
                  <span className="prompt-title">{p.title}</span>
                  <span className="prompt-text">{p.text.replace(/\s+/g, ' ')}</span>
                </button>
                <button type="button" className="btn-icon" aria-label={`Supprimer « ${p.title} »`} title="Supprimer" onClick={() => onDelete(p.id)}>
                  <Trash2 size={14} aria-hidden />
                </button>
              </li>
            ))}
            {prompts.length === 0 && (
              <li className="muted prompts-empty">Aucun modèle. Écris un message que tu réutilises souvent, puis « Enregistrer comme modèle ».</li>
            )}
          </>
        ) : (
          <>
            {shownSkills.map((c) => (
              <li key={c.title}>
                <button type="button" className="prompt-item" onClick={() => onInsert(`/${c.title} `)}>
                  <span className="prompt-title"><Puzzle size={13} aria-hidden /> /{c.title}</span>
                </button>
              </li>
            ))}
            {commands.length === 0 && <li className="muted prompts-empty">La liste arrive avec la 1re réponse de Claude.</li>}
          </>
        )}
        {query && (tab === 'prompts' ? shownPrompts : shownSkills).length === 0 && <li className="muted prompts-empty">Aucun résultat</li>}
      </ul>
      {tab === 'prompts' && (
        <div className="prompts-foot">
          <button type="button" className="btn-secondary" disabled={!draft.trim()} onClick={() => onSave(draft)} title="Garde le texte de la saisie pour plus tard">
            <BookmarkPlus size={14} aria-hidden /> Enregistrer comme modèle
          </button>
        </div>
      )}
    </div>
  );
}
