import { Check, Copy } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { artifactKind, artifactTitle } from '../../../shared/artifacts';
import { useOpenArtifact } from '../artifact-context';
import { ArtifactCard } from './artifact-card';

/** Nœud de l'arbre HTML (hast) produit par react-markdown : seul ce qui sert ici. */
interface HastNode {
  type: string;
  value?: string;
  tagName?: string;
  properties?: { className?: unknown };
  children?: HastNode[];
}

/** Texte brut d'un nœud (le code tel que Claude l'a écrit, sans la coloration). */
export function hastText(node: HastNode | undefined): string {
  if (!node) return '';
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(hastText).join('');
}

/** Langage d'un bloc de code (« language-ts » → « ts »), ou ''. */
export function codeLanguage(pre: HastNode | undefined): string {
  const code = pre?.children?.find((c) => c.tagName === 'code');
  const classes = code?.properties?.className;
  const list = Array.isArray(classes) ? classes.map(String) : [];
  return list.find((c) => c.startsWith('language-'))?.slice('language-'.length) ?? '';
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      className="btn-icon code-copy"
      aria-label={copied ? 'Copié' : 'Copier le code'}
      title={copied ? 'Copié' : 'Copier'}
      onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true), () => {})}
    >
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      <span>{copied ? 'Copié' : 'Copier'}</span>
    </button>
  );
}

function CodeBlock({ node, children }: { node?: HastNode; children?: ReactNode }) {
  const text = hastText(node).replace(/\n$/, '');
  const open = useOpenArtifact();
  const lang = codeLanguage(node);
  const kind = open ? artifactKind(lang, text) : null;
  // HTML, SVG ou Mermaid : une carte qui ouvre l'aperçu à droite, comme dans l'app Claude.
  if (open && kind) return <ArtifactCard artifact={{ kind, title: artifactTitle(kind, text), code: text }} onOpen={open} />;
  return (
    <div className="code-block">
      <div className="code-head">
        <span className="code-lang">{lang || 'code'}</span>
        <CopyButton text={text} />
      </div>
      <pre>{children}</pre>
    </div>
  );
}

// Sans rehype-raw, react-markdown échappe le HTML brut : Claude ne peut pas injecter de balises.
export function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{ pre: ({ node, children }) => <CodeBlock node={node as HastNode | undefined}>{children}</CodeBlock> }}
    >
      {text}
    </ReactMarkdown>
  );
}
