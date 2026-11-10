import type { ChatItem } from '../../shared/chat-item';
import { fold } from '../../shared/search';

/** Index des messages (toi ou Claude) qui contiennent la recherche, sans tenir compte de la casse ni des accents. */
export function findMatches(items: ChatItem[], query: string): number[] {
  const q = fold(query.trim());
  if (!q) return [];
  return items.flatMap((item, i) => ((item.kind === 'user' || item.kind === 'assistant') && fold(item.text).includes(q) ? [i] : []));
}

/** Position suivante (+1) ou précédente (-1) dans les résultats, en boucle. */
export function stepMatch(at: number, count: number, step: 1 | -1): number {
  return count === 0 ? 0 : (at + step + count) % count;
}

/** Positions [début, fin) de la recherche dans un texte affiché (pour le surlignage). Vide si le texte change de longueur une fois replié. */
export function occurrences(text: string, query: string): [number, number][] {
  const q = fold(query.trim());
  const t = fold(text);
  if (!q || t.length !== text.length) return [];
  const out: [number, number][] = [];
  for (let at = t.indexOf(q); at !== -1; at = t.indexOf(q, at + q.length)) out.push([at, at + q.length]);
  return out;
}
