// Mises à jour automatiques : lecture de la dernière Release GitHub (pur, testé).

/** Dépôt où sont publiées les Releases (installeur Plume-Setup-x.y.z.exe). */
export const RELEASES_API = 'https://api.github.com/repos/DYDewey/plume/releases/latest';
/** Seuls les téléchargements de ce dépôt sont acceptés. */
export const DOWNLOAD_PREFIX = 'https://github.com/DYDewey/plume/releases/download/';

export interface UpdateInfo {
  version: string;
  url: string;
  /** Empreinte sha256 (hex) annoncée par GitHub : le fichier téléchargé doit avoir la même. */
  sha256: string;
  size: number;
  /** Notes de version (texte de la Release), courtes. */
  notes: string;
}

/** Compare deux versions « 1.2.3 » : < 0 si a < b, 0 si égales, > 0 si a > b. Le reste (« v », « -beta ») est ignoré. */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => (/(\d+)\.(\d+)\.(\d+)/.exec(v) ?? []).slice(1, 4).map(Number);
  const [pa, pb] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

interface ReleaseAsset {
  name?: unknown;
  browser_download_url?: unknown;
  size?: unknown;
  digest?: unknown;
}

/**
 * Mise à jour proposée par la réponse de l'API GitHub, ou null : brouillon, pré-version, pas plus récente,
 * pas d'installeur à la bonne version, lien hors du dépôt ou empreinte sha256 absente.
 */
export function pickUpdate(release: unknown, current: string): UpdateInfo | null {
  if (!release || typeof release !== 'object') return null;
  const r = release as { tag_name?: unknown; draft?: unknown; prerelease?: unknown; body?: unknown; assets?: unknown };
  if (r.draft === true || r.prerelease === true || typeof r.tag_name !== 'string') return null;
  const version = /(\d+\.\d+\.\d+)/.exec(r.tag_name)?.[1];
  if (!version || compareVersions(version, current) <= 0 || !Array.isArray(r.assets)) return null;
  const asset = (r.assets as ReleaseAsset[]).find((a) => a?.name === `Plume-Setup-${version}.exe`);
  if (!asset || typeof asset.browser_download_url !== 'string' || !asset.browser_download_url.startsWith(DOWNLOAD_PREFIX)) return null;
  const sha256 = typeof asset.digest === 'string' ? /^sha256:([0-9a-f]{64})$/i.exec(asset.digest)?.[1]?.toLowerCase() : undefined;
  if (!sha256 || typeof asset.size !== 'number') return null;
  const notes = typeof r.body === 'string' ? r.body.trim().slice(0, 600) : '';
  return { version, url: asset.browser_download_url, sha256, size: asset.size, notes };
}
