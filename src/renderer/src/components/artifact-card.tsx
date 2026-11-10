import { ChevronRight, FileCode2, ImageIcon, Workflow } from 'lucide-react';
import type { Artifact, ArtifactKind } from '../../../shared/artifacts';

const LABELS: Record<ArtifactKind, string> = { html: 'Page interactive', svg: 'Image', mermaid: 'Diagramme' };

export function ArtifactIcon({ kind }: { kind: ArtifactKind }) {
  const Icon = kind === 'svg' ? ImageIcon : kind === 'mermaid' ? Workflow : FileCode2;
  return <Icon size={18} aria-hidden className="artifact-icon" />;
}

/** Carte dans le chat à la place du bloc de code : un clic ouvre l'aperçu à droite. */
export function ArtifactCard({ artifact, onOpen }: { artifact: Artifact; onOpen: (a: Artifact) => void }) {
  const lines = artifact.code.split('\n').length;
  return (
    <button type="button" className="artifact-card" onClick={() => onOpen(artifact)} title="Ouvrir l'aperçu">
      <span className="artifact-card-icon"><ArtifactIcon kind={artifact.kind} /></span>
      <span className="artifact-card-text">
        <span className="artifact-card-title">{artifact.title}</span>
        <span className="artifact-card-sub">{LABELS[artifact.kind]} · {lines} ligne{lines > 1 ? 's' : ''} · cliquer pour ouvrir</span>
      </span>
      <ChevronRight size={16} aria-hidden />
    </button>
  );
}
