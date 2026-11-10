import type { ChatItem } from './chat-item';

const TARGET_KEYS = ['file_path', 'path', 'command', 'pattern', 'url', 'query', 'skill', 'description'];

function toolLine(name: string, input: Record<string, unknown>): string {
  const key = TARGET_KEYS.find((k) => typeof input[k] === 'string');
  const target = key ? (input[key] as string).replace(/\s+/g, ' ').slice(0, 200) : '';
  return target ? `- *${name}* \`${target.replace(/`/g, "'")}\`` : `- *${name}*`;
}

/** Conversation en Markdown : messages en entier, outils résumés sur une ligne. */
export function toMarkdown(title: string, items: ChatItem[], date: Date): string {
  const out: string[] = [`# ${title}`, '', `*Exporté de Mon-Claude le ${date.toLocaleDateString('fr-FR')}*`, ''];
  let inTools = false;
  for (const item of items) {
    if (item.kind !== 'tool' && inTools) {
      out.push('');
      inTools = false;
    }
    switch (item.kind) {
      case 'user':
        out.push('## Toi', '', item.text, '');
        break;
      case 'assistant':
        out.push('## Claude', '', item.text, '');
        break;
      case 'tool':
        out.push(toolLine(item.name, item.input));
        inTools = true;
        break;
      case 'error':
        out.push(`> Erreur : ${item.message}`, '');
        break;
      case 'stopped':
        out.push('> Réponse arrêtée', '');
        break;
      case 'permission':
        break;
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/** Nom de fichier à partir du titre (« Mon titre » → « Mon titre.md »). */
export function exportFileName(title: string, ext: 'md' | 'pdf'): string {
  return `${cleanFileName(title).slice(0, 80).trim() || 'conversation'}.${ext}`;
}

const FORBIDDEN = '<>:"/\\|?*';

/** Nom de fichier accepté par Windows : caractères interdits et de contrôle remplacés, espaces resserrés. */
export function cleanFileName(name: string): string {
  return [...name]
    .map((c) => (c.charCodeAt(0) < 32 || FORBIDDEN.includes(c) ? ' ' : c))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}
