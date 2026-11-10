import { artifactKind, artifactTitle, langOfPath, type Artifact } from './artifacts';
import type { ChatItem } from './chat-item';
import { fileChanges, turnRanges } from './file-changes';

/** Nom du fichier au bout d'un chemin Windows ou POSIX. */
const baseName = (path: string) => path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;

/** Blocs de code d'un texte Markdown qui sont des artefacts, dans l'ordre. */
export function artifactsInText(text: string): Artifact[] {
  const out: Artifact[] = [];
  // Bloc ouvert par ``` (ou plus) en début de ligne, fermé par la même clôture.
  const fence = /^(`{3,})[ \t]*([\w-]*)[^\n]*\n([\s\S]*?)\n\1[ \t]*$/gm;
  for (const m of text.matchAll(fence)) {
    const code = m[3];
    const kind = artifactKind(m[2], code);
    if (kind) out.push({ kind, title: artifactTitle(kind, code), code });
  }
  return out;
}

/** Dernier artefact de la dernière réponse : bloc de code, ou page HTML / SVG écrite par Claude. */
export function lastArtifact(items: ChatItem[]): Artifact | null {
  const [start, end] = turnRanges(items).at(-1) ?? [0, 0];
  const turn = items.slice(start, end);
  let found: Artifact | null = null;
  for (const item of turn) {
    if (item.kind === 'assistant') found = artifactsInText(item.text).at(-1) ?? found;
  }
  if (found) return found;
  for (const change of fileChanges(turn).reverse()) {
    if (change.content === undefined) continue;
    const kind = artifactKind(langOfPath(change.path), change.content);
    if (kind) {
      const hasTitle = /<title[^>]*>[^<]*\S/i.test(change.content);
      return { kind, title: hasTitle ? artifactTitle(kind, change.content) : baseName(change.path), code: change.content };
    }
  }
  return null;
}
