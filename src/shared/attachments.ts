// Pièces jointes : on transmet le chemin des fichiers, claude les ouvre lui-même avec Read.

export function withAttachments(text: string, paths: string[]): string {
  const trimmed = text.trim();
  if (paths.length === 0) return trimmed;
  const list = ['Fichiers joints :', ...paths.map((p) => `- ${p}`)].join('\n');
  return trimmed ? `${trimmed}\n\n${list}` : list;
}

/** Ajoute à la fin, sans doublon. */
export function addAttachments(current: string[], added: string[]): string[] {
  return [...new Set([...current, ...added])];
}

/** Chemins des fichiers glissés-déposés ; pathFor renvoie '' pour ce qui n'est pas un fichier du disque. */
export function droppedPaths<T>(items: T[], pathFor: (item: T) => string): string[] {
  return items.map(pathFor).filter((p) => p !== '');
}

const IMAGE_MIME: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };

/** Extension sous laquelle enregistrer une image collée, ou null si ce n'est pas une image gérée. */
export function imageExt(mime: string): string | null {
  return IMAGE_MIME[mime] ?? null;
}

export function canSend(text: string, paths: string[]): boolean {
  return text.trim() !== '' || paths.length > 0;
}

export function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** Fichier image dont on peut montrer une miniature (d'après l'extension). */
export function isImagePath(path: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(path);
}
