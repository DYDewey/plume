import { useId } from 'react';

// Logo de Plume : une plume blanche sur un carré arrondi terracotta.
// Mêmes tracés que resources/logo.svg (source de l'icône Windows), vérifiés par tests/logo.test.tsx.
export const LOGO_PATHS = {
  vane: 'M50 10C51.5 21 47 31 38.5 37.5L35.5 36.5L36.6 39.4C31.8 42.6 26.6 44.4 21.2 45C20.4 39.3 21.6 33.4 24.6 28.3L27.4 29.2L26.6 26.1C32 18.4 40.4 12.4 50 10Z',
  shaft: 'M14.5 51.5L44.5 17',
  quill: 'M14.5 51.5L21.4 43.6',
};

/** Le logo, à la taille demandée (px). */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  const id = `fond-${useId().replace(/:/g, '')}`; // un dégradé par logo : deux logos à l'écran ne se mélangent pas
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--logo-from)" />
          <stop offset="1" stopColor="var(--logo-to)" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${id})`} />
      <path d={LOGO_PATHS.vane} fill="var(--on-accent)" />
      <path d={LOGO_PATHS.shaft} stroke={`url(#${id})`} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d={LOGO_PATHS.quill} stroke="var(--on-accent)" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}
