import type { ChatItem } from './chat-item';

// Fichiers modifiés par Claude pendant une réponse, déduits des entrées de ses outils (sans lire le disque).

export type DiffLine = { type: 'same' | 'add' | 'del'; text: string };

/** Au-delà (lignes avant × lignes après), on ne cherche plus les lignes communes : tout retiré puis tout ajouté. */
const LCS_MAX = 250_000;

/** Diff ligne à ligne (plus longue sous-suite commune). */
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before === '' ? [] : before.split('\n');
  const b = after === '' ? [] : after.split('\n');
  if (a.length * b.length > LCS_MAX) {
    return [...a.map((text) => ({ type: 'del' as const, text })), ...b.map((text) => ({ type: 'add' as const, text }))];
  }
  // lcs[i][j] = longueur commune de a[i..] et b[j..]
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ type: 'del', text: a[i++] });
    } else {
      out.push({ type: 'add', text: b[j++] });
    }
  }
  while (i < a.length) out.push({ type: 'del', text: a[i++] });
  while (j < b.length) out.push({ type: 'add', text: b[j++] });
  return out;
}

export interface FileChange {
  path: string;
  /** « created » : écrit en entier par Write (ancien contenu inconnu). */
  kind: 'edited' | 'created';
  added: number;
  removed: number;
  /** Une partie par appel d'outil, dans l'ordre. */
  parts: DiffLine[][];
  /** Dernier contenu complet écrit (Write), pour l'aperçu des pages HTML / SVG. */
  content?: string;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Diffs produits par un appel d'outil, ou null si ce n'est pas une modification de fichier. */
interface Replacement {
  old: string;
  new: string;
  all: boolean;
}

function toolDiffs(
  name: string,
  input: Record<string, unknown>,
): { path: string; kind: FileChange['kind']; parts: DiffLine[][]; content?: string; edits?: Replacement[] } | null {
  const path = str(input.file_path) || str(input.notebook_path);
  if (!path) return null;
  const edits = name === 'Edit' ? [input] : name === 'MultiEdit' && Array.isArray(input.edits) ? input.edits : null;
  if (edits) {
    const list = edits
      .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
      .map((e) => ({ old: str(e.old_string), new: str(e.new_string), all: e.replace_all === true }));
    return { path, kind: 'edited', parts: list.map((e) => lineDiff(e.old, e.new)), edits: list };
  }
  if (name === 'Write') return { path, kind: 'created', parts: [lineDiff('', str(input.content))], content: str(input.content) };
  if (name === 'NotebookEdit') return { path, kind: 'edited', parts: [lineDiff('', str(input.new_source))] };
  return null;
}

// Les éléments du chat ne changent jamais une fois créés : le diff de chaque outil est calculé une seule fois,
// pas à chaque morceau de texte reçu pendant la réponse.
const diffCache = new WeakMap<object, ReturnType<typeof toolDiffs>>();
function cachedDiffs(item: Extract<ChatItem, { kind: 'tool' }>): ReturnType<typeof toolDiffs> {
  if (!diffCache.has(item)) diffCache.set(item, toolDiffs(item.name, item.input));
  return diffCache.get(item) ?? null;
}

/** Contenu après les remplacements ; undefined si l'un d'eux ne s'applique pas (contenu réel inconnu). */
function applyEdits(content: string, edits: Replacement[]): string | undefined {
  if (edits.length === 0) return undefined; // NotebookEdit : pas rejouable
  let text = content;
  for (const e of edits) {
    if (!e.old || !text.includes(e.old)) return undefined;
    text = e.all ? text.split(e.old).join(e.new) : text.replace(e.old, () => e.new);
  }
  return text;
}

/** Fichiers modifiés par les outils de `items` (une réponse), un par chemin, dans l'ordre de 1re modification. */
export function fileChanges(items: ChatItem[]): FileChange[] {
  const byPath = new Map<string, FileChange>();
  for (const item of items) {
    if (item.kind !== 'tool') continue;
    const d = cachedDiffs(item);
    if (!d) continue;
    const key = d.path.toLowerCase(); // Windows : C:\A.ts et c:\a.ts sont le même fichier
    const change = byPath.get(key) ?? { path: d.path, kind: d.kind, added: 0, removed: 0, parts: [] };
    if (d.kind === 'created') {
      // Réécrit en entier : les modifications précédentes ne comptent plus.
      Object.assign(change, { kind: 'created', added: 0, removed: 0, parts: [] });
      change.content = d.content;
    } else if (change.content !== undefined) {
      // Modifié après l'écriture : on rejoue les remplacements sur le contenu connu (comme l'outil Edit sur le disque).
      change.content = applyEdits(change.content, d.edits ?? []);
    }
    for (const part of d.parts) {
      change.parts.push(part);
      change.added += part.filter((l) => l.type === 'add').length;
      change.removed += part.filter((l) => l.type === 'del').length;
    }
    byPath.set(key, change);
  }
  return [...byPath.values()];
}

/** Plages [début, fin) de chaque réponse de Claude : du message de l'utilisateur au suivant. */
export function turnRanges(items: ChatItem[]): [number, number][] {
  const starts = items.flatMap((it, i) => (it.kind === 'user' ? [i] : []));
  if (starts[0] !== 0) starts.unshift(0);
  return starts.map((s, k) => [s, starts[k + 1] ?? items.length]);
}

export type Shown = DiffLine | { type: 'gap'; count: number };

/** Garde les lignes changées et `context` lignes autour ; le reste devient « … N lignes ». */
export function withContext(lines: DiffLine[], context = 2): Shown[] {
  const keep = lines.map(() => false);
  lines.forEach((l, i) => {
    if (l.type === 'same') return;
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) keep[k] = true;
  });
  const out: Shown[] = [];
  let gap = 0;
  lines.forEach((l, i) => {
    if (keep[i]) {
      if (gap) out.push({ type: 'gap', count: gap });
      gap = 0;
      out.push(l);
    } else gap++;
  });
  if (gap) out.push({ type: 'gap', count: gap });
  return out;
}
