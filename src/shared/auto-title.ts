// Titre automatique d'une conversation, proposé par le juge Gemini gratuit dès que le but est clair.

export const TITLE_SYSTEM = [
  "Tu donnes un titre à une conversation entre un utilisateur et un assistant de code.",
  "Réponds UNIQUEMENT par le titre : 2 à 6 mots, en français, sans guillemets ni point final, première lettre en majuscule.",
  "Le titre dit le BUT de l'utilisateur (ex. « Écran paramètres de Plume », « Bug de connexion NFC »).",
  "Si le but n'est pas encore clair (simple salutation, « continuons », message vide de sens), réponds exactement : AUCUN",
].join('\n');

/** Nombre de tours après lequel on arrête de chercher un titre. */
export const TITLE_MAX_TRIES = 3;
const TITLE_MAX = 60;

/** Début de la conversation envoyé au juge : messages de l'utilisateur et dernière réponse, raccourcis. */
export function titleExcerpt(userTexts: string[], lastReply: string): string {
  const cut = (t: string, n: number) => (t.length > n ? t.slice(0, n) + '…' : t);
  const users = userTexts.slice(0, 3).map((t, i) => `Message ${i + 1} de l'utilisateur : ${cut(t.trim(), 600)}`);
  return [...users, `Réponse de l'assistant : ${cut(lastReply.trim(), 600)}`].join('\n\n');
}

/** Nettoie la réponse du juge ; null si elle ne contient pas de titre utilisable. */
export function cleanTitle(raw: string): string | null {
  const line = raw.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  const title = line
    .replace(/^(titre\s*:\s*)/i, '')
    .replace(/^[«"'“*#\s]+|[»"'”*.\s]+$/g, '')
    .trim();
  if (!title || /^aucun$/i.test(title) || title.length < 3) return null;
  const chars = [...title];
  return chars.length > TITLE_MAX ? chars.slice(0, TITLE_MAX - 1).join('').trimEnd() + '…' : title;
}

/** Nom du dossier de ~/.claude/projects/ pour un dossier de travail (C:\a\b → C--a-b). */
export function claudeFolder(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-');
}
