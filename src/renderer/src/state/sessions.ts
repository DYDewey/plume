import type { ChatItem } from '../../../shared/chat-item';
import type { BridgeEvent, LimitWindow } from '../../../shared/events';
import type { ModelChoice } from '../../../shared/model';

export type { ChatItem };

// État de toutes les sessions ouvertes. Reducer pur : (état, action) → nouvel état, sans effet de bord.

export interface SessionState {
  id: string;
  cwd: string;
  title: string;
  items: ChatItem[];
  status: 'idle' | 'running';
  /** Une réponse est arrivée pendant que la session n'était pas affichée. */
  unread: boolean;
  /** Taille du contexte après le dernier tour (inconnue avant la 1re réponse). */
  context?: { used: number; max: number };
  /** Modèle choisi dans l'app (absent : « Par défaut »). */
  model?: ModelChoice;
  /** Modèle réellement utilisé, lu au démarrage de claude (ex. claude-opus-5-5). */
  activeModel?: string;
  /** Qui a vraiment répondu au dernier tour, d'après le routeur ccr (absent : claude direct). */
  responder?: { provider: string; model: string };
  /** Prochain message proposé par claude, effacé dès qu'on envoie. */
  suggestion?: string;
}

export interface Limits {
  fiveHour?: LimitWindow;
  sevenDay?: LimitWindow;
  /** Présent si les jauges viennent du cache (localStorage) : date de la sauvegarde, en ms. */
  savedAt?: number;
}

export interface ChatState {
  sessions: SessionState[];
  activeId: string | null;
  /** Commandes et skills proposés quand on tape « / » (les mêmes pour toutes les sessions). */
  commands: string[];
  /** Jauges de l'abonnement (communes à toutes les sessions). */
  limits?: Limits;
}

export type ChatAction =
  | BridgeEvent
  | { type: 'session-opened'; sessionId: string; cwd: string; model?: ModelChoice }
  | { type: 'model-changed'; sessionId: string; model: ModelChoice | undefined }
  | { type: 'session-closed'; sessionId: string }
  | { type: 'select'; sessionId: string }
  | { type: 'user-sent'; sessionId: string; text: string }
  | { type: 'user-interrupted'; sessionId: string };

export const initialState: ChatState = { sessions: [], activeId: null, commands: [] };

const TITLE_MAX = 40;

export function sessionsReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'session-opened': {
      const title = action.cwd.split(/[\\/]/).filter(Boolean).pop() ?? action.cwd;
      const session: SessionState = { id: action.sessionId, cwd: action.cwd, title, items: [], status: 'idle', unread: false, model: action.model };
      return { ...state, sessions: [...state.sessions, session], activeId: action.sessionId };
    }
    case 'session-closed': {
      const sessions = state.sessions.filter((s) => s.id !== action.sessionId);
      const activeId = state.activeId === action.sessionId ? (sessions.at(-1)?.id ?? null) : state.activeId;
      return { ...state, sessions, activeId };
    }
    case 'select':
      return { ...state, activeId: action.sessionId, sessions: patch(state, action.sessionId, () => ({ unread: false })) };
    case 'user-sent':
      return update(state, action.sessionId, (s) => ({
        title: s.items.some((i) => i.kind === 'user') ? s.title : action.text.slice(0, TITLE_MAX),
        items: [...s.items, { kind: 'user', text: action.text }],
        status: 'running',
        suggestion: undefined,
      }));
    case 'user-interrupted':
      // Le statut reste « running » : c'est le turn-end envoyé par claude qui rend la main.
      return update(state, action.sessionId, (s) => ({ items: [...s.items, { kind: 'stopped' }] }));
    case 'commands':
      return { ...state, commands: action.names };
    case 'rate-limits':
      return { ...state, limits: { fiveHour: action.fiveHour, sevenDay: action.sevenDay } };
    // Pas fromBridge : ces infos ne sont pas une « réponse » à lire.
    case 'context':
      return update(state, action.sessionId, () => ({ context: { used: action.used, max: action.max } }));
    case 'model-changed':
      return update(state, action.sessionId, () => ({ model: action.model, activeModel: undefined }));
    case 'model':
      return update(state, action.sessionId, () => ({ activeModel: action.model }));
    case 'responder':
      return update(state, action.sessionId, () => ({ responder: { provider: action.provider, model: action.model } }));
    case 'suggestion':
      return update(state, action.sessionId, () => ({ suggestion: action.text }));
    case 'text-delta':
      return fromBridge(state, action.sessionId, (s) => {
        const last = s.items.at(-1);
        const items =
          last?.kind === 'assistant'
            ? [...s.items.slice(0, -1), { kind: 'assistant' as const, text: last.text + action.text }]
            : [...s.items, { kind: 'assistant' as const, text: action.text }];
        return { items };
      });
    case 'tool-use':
      return fromBridge(state, action.sessionId, (s) => ({
        items: [...s.items, { kind: 'tool', name: action.name, input: action.input }],
      }));
    case 'turn-end':
      return fromBridge(state, action.sessionId, () => ({ status: 'idle' }));
    case 'error':
      return fromBridge(state, action.sessionId, (s) => ({
        items: [...s.items, { kind: 'error', message: action.message }],
        status: 'idle',
      }));
  }
}

type Patch = (s: SessionState) => Partial<SessionState>;

function patch(state: ChatState, id: string, fn: Patch): SessionState[] {
  return state.sessions.map((s) => (s.id === id ? { ...s, ...fn(s) } : s));
}

function update(state: ChatState, id: string, fn: Patch): ChatState {
  if (!state.sessions.some((s) => s.id === id)) return state;
  return { ...state, sessions: patch(state, id, fn) };
}

/** Pour les événements venus de claude : une session non affichée devient « non lue ». */
function fromBridge(state: ChatState, id: string, fn: Patch): ChatState {
  return update(state, id, (s) => ({ ...fn(s), ...(id !== state.activeId && { unread: true }) }));
}
