import type { ChatItem } from '../shared/chat-item';

// Convertit les lignes d'un .jsonl de ~/.claude/projects/ en éléments de chat.
// Le format n'est pas documenté : on ne garde que ce qu'on connaît et on ignore le reste sans planter.

export interface ParsedSession {
  title: string;
  cwd?: string;
  /** Date de la dernière ligne datée, en ms. */
  lastAt?: number;
  /** Messages user + assistant (sans les outils). */
  messageCount: number;
  items: ChatItem[];
}

const TITLE_MAX = 60;

interface Block {
  type?: string;
  text?: unknown;
  name?: unknown;
  input?: unknown;
}

/** Texte d'un message user, ou null s'il est purement technique (caveat, notification…). */
function userText(content: unknown): string | null {
  const raw =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? (content as Block[])
            .filter((b) => b.type === 'text' && typeof b.text === 'string')
            .map((b) => b.text)
            .join('\n')
        : '';
  const text = raw.trim();
  if (!text) return null;
  // Une commande tapée (« /clear ») est enregistrée en balises : on la réaffiche comme tapée.
  const command = /<command-name>([^<]*)<\/command-name>/.exec(text);
  if (command) {
    const args = /<command-args>([^<]*)<\/command-args>/.exec(text)?.[1]?.trim();
    return args ? `${command[1]} ${args}` : command[1];
  }
  if (/^<(local-command|task-notification)/.test(text)) return null;
  // Commande « ! » tapée dans le terminal : on la réaffiche comme tapée ; sa sortie brute est masquée.
  const bash = /^<bash-input>([^]*)<\/bash-input>$/.exec(text);
  if (bash) return `! ${bash[1].trim()}`;
  if (/^<bash-(stdout|stderr)>/.test(text)) return null;
  return text;
}

function truncate(text: string): string {
  const chars = [...text.replace(/\s+/g, ' ')];
  return chars.length > TITLE_MAX ? chars.slice(0, TITLE_MAX - 1).join('') + '…' : chars.join('');
}

export function parseSession(lines: string[]): ParsedSession {
  const items: ChatItem[] = [];
  let customTitle: string | undefined;
  let aiTitle: string | undefined;
  let firstPrompt: string | undefined;
  let cwd: string | undefined;
  let lastAt: number | undefined;
  let messageCount = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    let o: Record<string, unknown>;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof o.timestamp === 'string') {
      const t = Date.parse(o.timestamp);
      if (!Number.isNaN(t)) lastAt = t;
    }
    if (o.type === 'custom-title' && typeof o.customTitle === 'string') customTitle = o.customTitle;
    if (o.type === 'ai-title' && typeof o.aiTitle === 'string') aiTitle = o.aiTitle;
    if (o.type !== 'user' && o.type !== 'assistant') continue;
    // Messages techniques (contenu de skill, hooks…) et sous-agents : pas affichés.
    if (o.isMeta || o.isSidechain) continue;
    if (typeof o.cwd === 'string') cwd = o.cwd;
    const content = (o.message as { content?: unknown } | undefined)?.content;

    if (o.type === 'user') {
      const text = userText(content);
      if (text === null) continue;
      items.push({ kind: 'user', text });
      messageCount++;
      if (firstPrompt === undefined && !text.startsWith('/') && !text.startsWith('! ')) firstPrompt = text;
      continue;
    }
    if (!Array.isArray(content)) continue;
    for (const b of content as Block[]) {
      if (b.type === 'text' && typeof b.text === 'string' && b.text.trim()) {
        items.push({ kind: 'assistant', text: b.text });
        messageCount++;
      } else if (b.type === 'tool_use' && typeof b.name === 'string') {
        const input = b.input && typeof b.input === 'object' ? (b.input as Record<string, unknown>) : {};
        items.push({ kind: 'tool', name: b.name, input });
      }
    }
  }

  const title = customTitle ?? aiTitle ?? (firstPrompt ? truncate(firstPrompt) : 'Sans titre');
  return { title, cwd, lastAt, messageCount, items };
}
