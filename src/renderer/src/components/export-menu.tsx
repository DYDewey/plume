import { Download, FileDown, FileText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/** Bouton « Exporter » de la barre du haut : Markdown ou PDF. */
export function ExportMenu({ onMarkdown, onPdf, disabled = false }: { onMarkdown: () => void; onPdf: () => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Clic ailleurs ou Échap : le menu se ferme.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="export-menu" ref={root}>
      <button type="button" className="btn-icon" aria-haspopup="menu" aria-expanded={open} aria-label="Exporter la conversation" title="Exporter" disabled={disabled} onClick={() => setOpen((o) => !o)}>
        <Download size={16} aria-hidden />
      </button>
      {open && (
        <div className="menu" role="menu">
          <button type="button" role="menuitem" onClick={pick(onMarkdown)}>
            <FileText size={14} aria-hidden /> Markdown (.md)
          </button>
          <button type="button" role="menuitem" onClick={pick(onPdf)}>
            <FileDown size={14} aria-hidden /> PDF
          </button>
        </div>
      )}
    </div>
  );
}
