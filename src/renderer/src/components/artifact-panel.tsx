import { Check, Code2, Copy, Download, Eye, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { artifactFileName, artifactPage, type Artifact } from '../../../shared/artifacts';
import { clampWidth } from '../ui-format';
import { ArtifactIcon } from './artifact-card';

interface Props {
  artifact: Artifact;
  /** Confie la page au main et renvoie son adresse artifact://. */
  load: (html: string) => Promise<string>;
  onSave: (name: string, text: string) => void;
  onClose: () => void;
  /** Largeur en px ; la poignée de gauche la change à la souris (ou au clavier). */
  width: number;
  onResize: (width: number) => void;
}

/** Poignée verticale à gauche du panneau : glisser change la largeur, flèches gauche / droite aussi. */
function ResizeHandle({ width, onResize, onDrag }: { width: number; onResize: (w: number) => void; onDrag: (on: boolean) => void }) {
  return (
    <div
      className="artifact-resize"
      role="separator"
      aria-orientation="vertical"
      aria-label="Largeur du panneau"
      aria-valuenow={width}
      tabIndex={0}
      title="Glisser pour changer la largeur"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        onDrag(true);
      }}
      onPointerMove={(e) => {
        // Le panneau touche le bord droit : sa largeur = distance entre la souris et ce bord.
        if (e.currentTarget.hasPointerCapture(e.pointerId)) onResize(clampWidth(window.innerWidth - e.clientX, window.innerWidth));
      }}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        onDrag(false);
      }}
      onKeyDown={(e) => {
        const step = { ArrowLeft: 40, ArrowRight: -40 }[e.key];
        if (step) {
          e.preventDefault();
          onResize(clampWidth(width + step, window.innerWidth));
        }
      }}
    />
  );
}

/** Panneau à droite du chat : aperçu de l'artefact dans une iframe isolée, ou son code. */
export function ArtifactPanel({ artifact, load, onSave, onClose, width, onResize }: Props) {
  const [view, setView] = useState<'preview' | 'code'>('preview');
  // Pendant le glissement, l'iframe ne doit pas avaler les mouvements de la souris.
  const [dragging, setDragging] = useState(false);
  const [loaded, setLoaded] = useState<{ code: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const url = loaded?.code === artifact.code ? loaded.url : null;

  useEffect(() => {
    let stale = false;
    load(artifactPage(artifact.kind, artifact.code)).then(
      (u) => {
        if (!stale) setLoaded({ code: artifact.code, url: u });
      },
      (err) => console.error('artefact non chargé', err),
    );
    return () => {
      stale = true;
    };
  }, [artifact, load]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <aside
      className={dragging ? 'artifact-panel dragging' : 'artifact-panel'}
      aria-label={`Artefact : ${artifact.title}`}
      style={{ flexBasis: clampWidth(width, window.innerWidth) }}
    >
      <ResizeHandle width={width} onResize={onResize} onDrag={setDragging} />
      <header className="artifact-head">
        <ArtifactIcon kind={artifact.kind} />
        <span className="artifact-title" title={artifact.title}>{artifact.title}</span>
        <div className="segmented artifact-views" role="radiogroup" aria-label="Affichage">
          <button type="button" role="radio" aria-checked={view === 'preview'} className={view === 'preview' ? 'on' : undefined} onClick={() => setView('preview')}>
            <Eye size={14} aria-hidden /> Aperçu
          </button>
          <button type="button" role="radio" aria-checked={view === 'code'} className={view === 'code' ? 'on' : undefined} onClick={() => setView('code')}>
            <Code2 size={14} aria-hidden /> Code
          </button>
        </div>
        <button type="button" className="btn-icon" aria-label={copied ? 'Copié' : 'Copier le code'} title={copied ? 'Copié' : 'Copier le code'}
          onClick={() => navigator.clipboard.writeText(artifact.code).then(() => setCopied(true), () => {})}>
          {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
        </button>
        <button type="button" className="btn-icon" aria-label="Enregistrer" title="Enregistrer" onClick={() => onSave(artifactFileName(artifact), artifact.code)}>
          <Download size={16} aria-hidden />
        </button>
        <button type="button" className="btn-icon" aria-label="Fermer l'artefact" title="Fermer" onClick={onClose}>
          <X size={16} aria-hidden />
        </button>
      </header>
      <div className="artifact-body">
        {view === 'code' ? (
          <pre className="artifact-code"><code>{artifact.code}</code></pre>
        ) : url ? (
          // Origine opaque (pas de allow-same-origin) : la page ne voit ni l'app ni Node.
          <iframe key={url} src={url} title={artifact.title} sandbox="allow-scripts allow-popups allow-modals" className="artifact-frame" />
        ) : (
          <p className="muted artifact-loading">Chargement…</p>
        )}
      </div>
    </aside>
  );
}
