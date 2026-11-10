import { RotateCw, Search } from 'lucide-react';
import { useState } from 'react';
import type { HistoryProject, HistorySession } from '../../../shared/history';
import type { SearchHit } from '../../../shared/search';
import { displayTitle, emptyOrganize, sessionKey, type OrganizeData } from '../../../shared/organize';
import { filterHistory, folderLabel, HISTORY_SEARCH_ID } from '../ui-format';
import { ago } from '../usage-format';
import { groupByDate, isTechnicalProject, shortWhen } from '../history-groups';
import { FavoriteButton } from './favorite-button';
import { SearchResults, useContentSearch } from './search-results';
import { RenameButton, RenameField } from './rename-field';

interface Props {
  projects: HistoryProject[];
  now: number;
  /** `folder/id` de la session affichée, s'il y en a une. */
  openKey?: string;
  /** `focusIndex` : message à montrer (résultat de recherche dans le contenu). */
  onOpen: (folder: string, id: string, focusIndex?: number) => void;
  onRefresh: () => void;
  /** Favoris et noms personnalisés (vide par défaut). */
  organize?: OrganizeData;
  onToggleFavorite?: (key: string) => void;
  /** Nom vide : retour au titre d'origine. */
  onRename?: (key: string, title: string) => void;
  /** Recherche dans le contenu (par défaut : main, via window.claude). */
  search?: (query: string) => Promise<SearchHit[]>;
  /** Pour les tests : recherche déjà saisie. */
  initialQuery?: string;
  /** Réglage : montrer aussi les sessions techniques (claude-mem…). */
  showTechnical?: boolean;
}

/** Dernier dossier du vrai chemin (« mon-claude »), sinon le nom encodé du dossier. */
export function projectLabel(project: HistoryProject): string {
  return project.path ? folderLabel(project.path) : project.folder;
}

const NO_ORGANIZE = emptyOrganize();
// Hors du composant : une fonction stable, sinon l'attente de 300 ms repartirait à chaque rendu.
const searchInMain = (query: string) => window.claude.searchHistory(query);

export function HistoryList({
  projects,
  now,
  openKey,
  onOpen,
  onRefresh,
  organize = NO_ORGANIZE,
  onToggleFavorite = () => {},
  onRename = () => {},
  initialQuery = '',
  search = searchInMain,
  showTechnical = false,
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  /** Clé de la session en cours de renommage. */
  const [editing, setEditing] = useState<string | null>(null);
  const titleOf = (folder: string, s: HistorySession) => displayTitle(s, organize.sessions[sessionKey(folder, s.id)]);
  const searching = query.trim() !== '';
  const visible = showTechnical ? projects : projects.filter((p) => !isTechnicalProject(p));
  const shown = filterHistory(visible, query, titleOf);
  const contentResults = useContentSearch(query, search);
  return (
    <section className="history">
      <div className="history-head">
        <span>Historique</span>
        <button className="btn-icon" aria-label="Rafraîchir l'historique" title="Rafraîchir l'historique" onClick={onRefresh}>
          <RotateCw size={14} aria-hidden />
        </button>
      </div>
      <label className="search">
        <Search size={14} aria-hidden />
        <input
          type="search"
          id={HISTORY_SEARCH_ID}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher"
          aria-label="Rechercher dans l'historique"
        />
      </label>
      {searching && shown.length === 0 && <p className="muted no-result">Aucun résultat</p>}
      {groupByDate(shown, now).map((group) => (
        <div key={group.label} className="history-group">
          <div className="history-group-label">{group.label}</div>
          <ul>
            {group.rows.map(({ folder, session: s, project }) => {
              const key = sessionKey(folder, s.id);
              const title = titleOf(folder, s);
              return (
                <li
                  key={key}
                  className={openKey === key ? 'history-item active' : 'history-item'}
                  onClick={() => onOpen(folder, s.id)}
                  title={`${title}\n${project} · ${ago(s.lastAt, now)}`}
                >
                  {editing === key ? (
                    <RenameField
                      initial={title}
                      onSave={(name) => {
                        setEditing(null);
                        onRename(key, name);
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <>
                      <span className="history-text">
                        <span className="sidebar-title">{title}</span>
                        <span className="history-meta">{project} · {shortWhen(s.lastAt, now)}</span>
                      </span>
                      <RenameButton onClick={() => setEditing(key)} />
                      <FavoriteButton on={!!organize.sessions[key]?.favorite} onToggle={() => onToggleFavorite(key)} />
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <SearchResults results={contentResults} organize={organize} onOpen={onOpen} />
    </section>
  );
}
