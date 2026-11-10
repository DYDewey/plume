import { ChevronRight, Eye, FilePen, FilePlus } from 'lucide-react';
import { artifactKind, artifactTitle, langOfPath } from '../../../shared/artifacts';
import { withContext, type FileChange } from '../../../shared/file-changes';
import { useOpenArtifact } from '../artifact-context';
import { folderLabel } from '../ui-format';

/** Au-delà, le diff d'un fichier est coupé (un Write de 2 000 lignes ne doit pas figer l'interface). */
const DIFF_MAX_LINES = 400;

function Counts({ added, removed }: { added: number; removed: number }) {
  return (
    <span className="diff-counts">
      {added > 0 && <span className="diff-plus">+{added}</span>}
      {removed > 0 && <span className="diff-minus">−{removed}</span>}
    </span>
  );
}

function FileDiff({ change }: { change: FileChange }) {
  const shown = change.parts.flatMap((part, i) => [...(i > 0 ? [{ type: 'gap' as const, count: 0 }] : []), ...withContext(part)]);
  const cut = shown.length > DIFF_MAX_LINES;
  return (
    <pre className="diff">
      {shown.slice(0, DIFF_MAX_LINES).map((l, i) =>
        l.type === 'gap' ? (
          <span key={i} className="diff-gap">{l.count ? `… ${l.count} ligne${l.count > 1 ? 's' : ''} inchangée${l.count > 1 ? 's' : ''}` : '⋯'}</span>
        ) : (
          <span key={i} className={`diff-${l.type}`}>
            <span className="diff-sign" aria-hidden>{l.type === 'add' ? '+' : l.type === 'del' ? '−' : ' '}</span>
            {l.text || ' '}
          </span>
        ),
      )}
      {cut && <span className="diff-gap">… {shown.length - DIFF_MAX_LINES} lignes de plus</span>}
    </pre>
  );
}

/** Après une réponse : les fichiers modifiés par Claude, chacun dépliable pour voir ce qui a changé. */
export function FilesCard({ changes }: { changes: FileChange[] }) {
  const open = useOpenArtifact();
  if (changes.length === 0) return null;
  const added = changes.reduce((n, c) => n + c.added, 0);
  const removed = changes.reduce((n, c) => n + c.removed, 0);
  return (
    <section className="files-card" aria-label="Fichiers modifiés">
      <header className="files-head">
        <FilePen size={14} aria-hidden />
        <span>{changes.length} fichier{changes.length > 1 ? 's' : ''} modifié{changes.length > 1 ? 's' : ''}</span>
        <Counts added={added} removed={removed} />
      </header>
      {changes.map((c) => {
        const kind = c.content !== undefined ? artifactKind(langOfPath(c.path), c.content) : null;
        const name = folderLabel(c.path);
        return (
          <details key={c.path} className="file-row">
            <summary title={c.path}>
              <ChevronRight size={14} aria-hidden className="chev" />
              {c.kind === 'created' ? <FilePlus size={14} aria-hidden /> : <FilePen size={14} aria-hidden />}
              <span className="file-name">{name}</span>
              <span className="file-dir">{c.path.slice(0, Math.max(0, c.path.length - name.length - 1))}</span>
              <Counts added={c.added} removed={c.removed} />
              {open && kind && c.content !== undefined && (
                <button
                  type="button"
                  className="btn-icon file-preview"
                  title="Aperçu"
                  aria-label={`Aperçu de ${name}`}
                  onClick={(e) => {
                    e.preventDefault(); // ne pas déplier la ligne
                    open({ kind, title: /<title[^>]*>[^<]*\S/i.test(c.content!) ? artifactTitle(kind, c.content!) : name, code: c.content! });
                  }}
                >
                  <Eye size={14} aria-hidden />
                </button>
              )}
            </summary>
            <FileDiff change={c} />
          </details>
        );
      })}
    </section>
  );
}
