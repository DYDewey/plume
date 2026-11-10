// Modèles de messages réutilisables, insérés dans la saisie depuis le panneau des prompts.

export interface SavedPrompt {
  id: string;
  title: string;
  text: string;
}

const TITLE_MAX = 48;
const MAX_PROMPTS = 200;

/** Titre tiré de la 1re ligne non vide du texte. */
export function promptTitle(text: string): string {
  const first = text.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  const chars = [...first];
  return chars.length > TITLE_MAX ? chars.slice(0, TITLE_MAX - 1).join('') + '…' : first || 'Sans titre';
}

/** Liste lue depuis le stockage : ce qui est mal formé est ignoré. */
export function parsePrompts(raw: string | null): SavedPrompt[] {
  try {
    const value: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(value)) return [];
    return value
      .filter((p): p is SavedPrompt => !!p && typeof p.id === 'string' && typeof p.title === 'string' && typeof p.text === 'string')
      .slice(0, MAX_PROMPTS);
  } catch {
    return [];
  }
}

/** Ajoute un modèle en tête (texte identique : remonté, pas dupliqué). */
export function addPrompt(list: SavedPrompt[], text: string, id: string): SavedPrompt[] {
  const clean = text.trim();
  if (!clean) return list;
  const rest = list.filter((p) => p.text !== clean);
  return [{ id, title: promptTitle(clean), text: clean }, ...rest].slice(0, MAX_PROMPTS);
}

export function removePrompt(list: SavedPrompt[], id: string): SavedPrompt[] {
  return list.filter((p) => p.id !== id);
}

/** Filtre par mots (titre ou texte, sans tenir compte de la casse). */
export function filterPrompts<T extends { title: string; text?: string }>(list: T[], query: string): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return list;
  return list.filter((p) => {
    const hay = `${p.title} ${p.text ?? ''}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
