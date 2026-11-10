// Artefacts : pages HTML, images SVG et diagrammes Mermaid écrits par Claude, affichés à côté du chat.

export type ArtifactKind = 'html' | 'svg' | 'mermaid';

export interface Artifact {
  kind: ArtifactKind;
  title: string;
  code: string;
}

/** Version de mermaid chargée depuis le CDN (fixée : jamais « la dernière »). */
export const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js';

/** Ce bloc de code peut-il s'afficher en aperçu ? Selon son langage, ou l'extension du fichier écrit. */
export function artifactKind(lang: string, code: string): ArtifactKind | null {
  const l = lang.toLowerCase();
  if ((l === 'html' || l === 'htm') && code.includes('<')) return 'html';
  if (l === 'svg' || ((l === 'xml' || l === '') && /^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(code))) return 'svg';
  if (l === 'mermaid' || l === 'mmd') return 'mermaid';
  return null;
}

/** Extension de fichier → langage d'artefact (« page.html » → 'html'). */
export function langOfPath(path: string): string {
  return /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase() ?? '';
}

const DEFAULT_TITLES: Record<ArtifactKind, string> = { html: 'Page HTML', svg: 'Image SVG', mermaid: 'Diagramme' };

/** Titre affiché : le <title> d'une page, sinon un nom générique. */
export function artifactTitle(kind: ArtifactKind, code: string): string {
  const t = kind === 'html' ? /<title[^>]*>([^<]*)<\/title>/i.exec(code)?.[1]?.trim() : undefined;
  return t || DEFAULT_TITLES[kind];
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const FRAME_STYLE = `
:root { color-scheme: light dark; }
html, body { margin: 0; min-height: 100%; background: Canvas; color: CanvasText; font-family: "Segoe UI Variable Text", "Segoe UI", sans-serif; }
body { display: grid; place-items: center; min-height: 100vh; padding: 16px; box-sizing: border-box; }
svg { max-width: 100%; height: auto; }`;

/** Page complète chargée dans l'iframe. */
export function artifactPage(kind: ArtifactKind, code: string): string {
  if (kind === 'html') return code;
  const head = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${FRAME_STYLE}</style>`;
  if (kind === 'svg') return `${head}</head><body>${code}</body></html>`;
  return `${head}<script src="${MERMAID_URL}"></script></head><body><pre class="mermaid">${escapeHtml(code)}</pre>
<script>
mermaid.initialize({ startOnLoad: false, theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default' });
mermaid.run().catch(function (e) { document.body.textContent = 'Diagramme illisible : ' + (e && e.message || e); });
</script></body></html>`;
}

/**
 * Règles de sécurité de la page d'artefact : scripts et styles inline, CDN connus seulement,
 * aucune requête réseau depuis le script (connect-src 'none'), rien d'autre.
 */
export const ARTIFACT_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com",
  "style-src 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
  'font-src https://fonts.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net data:',
  'img-src data: blob: https:',
  'media-src data: blob:',
  "connect-src 'none'",
  "form-action 'none'",
].join('; ');

/** Nom de fichier proposé à l'enregistrement. */
export function artifactFileName(a: Artifact): string {
  const base = a.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'artefact';
  return `${base}.${a.kind === 'mermaid' ? 'mmd' : a.kind}`;
}
