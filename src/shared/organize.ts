import type { HistoryProject, HistorySession } from './history';
import { parseProjects, type Project } from './projects';

// Favoris et noms personnalisés, rangés par l'app dans organize.json (jamais dans les .jsonl de Claude Code).

export interface SessionMeta {
  favorite?: true;
  title?: string;
  /** Masquée de l'historique de l'app (le fichier de Claude Code n'est pas touché). */
  hidden?: true;
}

export interface OrganizeData {
  version: 1;
  /** Clé : `sessionKey(dossier, id)`. Une entrée vide est retirée. */
  sessions: Record<string, SessionMeta>;
  /** Clé : identifiant `p_…` (cf. projects.ts). Absent dans les fichiers d'avant les projets. */
  projects?: Record<string, Project>;
}

export function sessionKey(folder: string, id: string): string {
  return `${folder}/${id}`;
}

export function emptyOrganize(): OrganizeData {
  return { version: 1, sessions: {} };
}

/** Remplace l'entrée `key` ; si elle n'a plus aucun champ, elle disparaît. */
function withMeta(data: OrganizeData, key: string, meta: SessionMeta): OrganizeData {
  const sessions = { ...data.sessions };
  if (meta.favorite || meta.title || meta.hidden) sessions[key] = meta;
  else delete sessions[key];
  return { ...data, sessions };
}

export function toggleFavorite(data: OrganizeData, key: string): OrganizeData {
  const { favorite, ...rest } = data.sessions[key] ?? {};
  return withMeta(data, key, favorite ? rest : { favorite: true, ...rest });
}

/** Nom vide ou fait d'espaces : on revient au titre d'origine. */
export function renameSession(data: OrganizeData, key: string, title: string): OrganizeData {
  const name = title.trim();
  const meta = { ...data.sessions[key] };
  delete meta.title;
  return withMeta(data, key, { ...meta, ...(name && { title: name }) });
}

/** Masque ou réaffiche une conversation dans l'historique de l'app. */
export function toggleHidden(data: OrganizeData, key: string): OrganizeData {
  const { hidden, ...rest } = data.sessions[key] ?? {};
  return withMeta(data, key, hidden ? rest : { ...rest, hidden: true });
}

export function displayTitle(session: Pick<HistorySession, 'title'>, meta: SessionMeta | undefined): string {
  return meta?.title ?? session.title;
}

export interface FavoriteEntry {
  project: HistoryProject;
  session: HistorySession;
}

/** Favoris encore présents dans l'historique, du plus récent au plus ancien. */
export function favoriteSessions(projects: HistoryProject[], data: OrganizeData): FavoriteEntry[] {
  return projects
    .flatMap((project) =>
      project.sessions
        .filter((session) => data.sessions[sessionKey(project.folder, session.id)]?.favorite)
        .map((session) => ({ project, session })),
    )
    .sort((a, b) => b.session.lastAt - a.session.lastAt);
}

/** Relit organize.json ; null s'il est illisible ou d'une version inconnue. Les champs inconnus sont ignorés. */
export function parseOrganize(text: string): OrganizeData | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(raw) || raw.version !== 1 || !isObject(raw.sessions)) return null;
  const data = emptyOrganize();
  for (const [key, value] of Object.entries(raw.sessions)) {
    // Une vraie clé est `dossier/id` : écarte aussi « __proto__ », qui changerait le prototype de `sessions`.
    if (!key.includes('/') || !isObject(value)) continue;
    const meta: SessionMeta = {};
    if (value.favorite === true) meta.favorite = true;
    if (typeof value.title === 'string' && value.title.trim()) meta.title = value.title.trim();
    if (value.hidden === true) meta.hidden = true;
    if (meta.favorite || meta.title || meta.hidden) data.sessions[key] = meta;
  }
  const projects = parseProjects(raw.projects);
  if (Object.keys(projects).length > 0) data.projects = projects;
  return data;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
