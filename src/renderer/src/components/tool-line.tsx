import { Bot, FilePen, FilePlus, FileText, Globe, Puzzle, Search, Terminal, Wrench, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  Read: FileText,
  Write: FilePlus,
  Edit: FilePen,
  Bash: Terminal,
  PowerShell: Terminal,
  Grep: Search,
  Glob: Search,
  WebFetch: Globe,
  WebSearch: Globe,
  Skill: Puzzle,
  Agent: Bot,
};

// Champs qui désignent « sur quoi » l'outil agit, par ordre de préférence.
const TARGET_KEYS = ['file_path', 'path', 'command', 'pattern', 'url', 'query', 'skill', 'description'];
const TARGET_MAX = 80;

/** Sur quoi l'outil agit, en entier : une demande de permission doit tout montrer. */
export function fullToolTarget(input: Record<string, unknown>): string {
  const key = TARGET_KEYS.find((k) => typeof input[k] === 'string');
  return key ? (input[key] as string) : '';
}

export function toolTarget(input: Record<string, unknown>): string {
  return fullToolTarget(input).slice(0, TARGET_MAX);
}

export function ToolIcon({ name }: { name: string }) {
  const Icon = ICONS[name] ?? Wrench;
  return <Icon size={14} aria-hidden />;
}

export function ToolLine({ name, input }: { name: string; input: Record<string, unknown> }) {
  return (
    <details className="msg msg-tool">
      <summary>
        <ToolIcon name={name} /> <strong>{name}</strong> <span className="tool-target">{toolTarget(input)}</span>
      </summary>
      <pre>{JSON.stringify(input, null, 2)}</pre>
    </details>
  );
}
