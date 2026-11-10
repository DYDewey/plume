import type { ChatItem } from '../../shared/chat-item';
import { TITLE_MAX_TRIES } from '../../shared/auto-title';

/** Suivi par session : essais faits, nombre de messages au dernier essai, titre trouvé. */
export interface TitleTrack {
  tries: number;
  userCount: number;
  done: boolean;
}

/** Messages de l'utilisateur qui comptent pour le titre (les commandes « / » ne disent rien du but). */
function userTextsOf(items: ChatItem[]): string[] {
  return items.flatMap((i) => (i.kind === 'user' && !i.text.trim().startsWith('/') ? [i.text] : []));
}

/** Point de départ : une conversation reprise ou continuée n'a droit à un titre qu'après un nouveau message. */
export function initialTrack(items: ChatItem[]): TitleTrack {
  return { tries: 0, userCount: userTextsOf(items).length, done: false };
}

export interface TitleRequest {
  userTexts: string[];
  lastReply: string;
  userCount: number;
}

/**
 * Faut-il demander un titre maintenant ? Oui après chaque nouvelle réponse complète, tant qu'aucun titre
 * n'est trouvé (le juge répond « AUCUN » si le but n'est pas clair), au plus TITLE_MAX_TRIES fois.
 * Jamais si l'utilisateur a déjà renommé la conversation.
 */
export function titleRequest(
  session: { status: 'idle' | 'running'; items: ChatItem[] },
  track: TitleTrack | undefined,
  renamed: boolean,
): TitleRequest | null {
  if (renamed || session.status !== 'idle' || track?.done || (track?.tries ?? 0) >= TITLE_MAX_TRIES) return null;
  const userTexts = userTextsOf(session.items);
  const userCount = userTexts.length;
  if (userCount === 0 || userCount <= (track?.userCount ?? 0)) return null;
  const last = session.items.at(-1);
  if (last?.kind !== 'assistant') return null;
  return { userTexts, lastReply: last.text, userCount };
}
