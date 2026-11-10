import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pickUpdate, RELEASES_API, type UpdateInfo } from '../shared/update';

/** Au-delà, le téléchargement est refusé (l'installeur fait ~120 Mo). */
const MAX_SIZE = 400_000_000;

/** Dernière Release GitHub plus récente que `current`, ou null (hors ligne, rien de neuf, Release incomplète). */
export async function checkUpdate(current: string, fetcher: typeof fetch = fetch): Promise<UpdateInfo | null> {
  try {
    const res = await fetcher(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Plume-updater' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return pickUpdate(await res.json(), current);
  } catch {
    return null;
  }
}

/**
 * Télécharge l'installeur dans le dossier temporaire en calculant son sha256 au fil de l'eau.
 * Empreinte ou taille différente de celles annoncées par GitHub : fichier supprimé, erreur.
 */
export async function downloadUpdate(info: UpdateInfo, onProgress: (ratio: number) => void, fetcher: typeof fetch = fetch): Promise<string> {
  if (info.size > MAX_SIZE) throw new Error('Installeur trop gros');
  const dir = join(tmpdir(), 'plume-update');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `Plume-Setup-${info.version}.exe`);
  const res = await fetcher(info.url, { headers: { 'User-Agent': 'Plume-updater' } });
  if (!res.ok || !res.body) throw new Error(`Téléchargement refusé (${res.status})`);
  const hash = createHash('sha256');
  const out = createWriteStream(path);
  let received = 0;
  try {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > MAX_SIZE) throw new Error('Installeur trop gros');
      hash.update(value);
      if (!out.write(value)) await new Promise((r) => out.once('drain', r));
      onProgress(Math.min(1, received / info.size));
    }
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
  } catch (err) {
    out.destroy();
    rmSync(path, { force: true });
    throw err;
  }
  const digest = hash.digest('hex');
  if (digest !== info.sha256 || received !== info.size) {
    rmSync(path, { force: true });
    throw new Error("L'installeur téléchargé ne correspond pas à celui publié (empreinte différente) : mise à jour annulée.");
  }
  return path;
}

/** Contenu du petit script qui attend la fermeture de Plume, installe en silencieux puis relance l'app. */
export function installScript(installer: string, appExe: string): string {
  return [
    '@echo off',
    'rem Mise a jour de Plume (script temporaire, supprime a la fin)',
    // timeout refuse de tourner sans clavier (stdin fermé) : ping sert d'attente de 2 s.
    'ping -n 3 127.0.0.1 >nul',
    `"${installer}" /S`,
    `start "" "${appExe}"`,
    `del "${installer}"`,
    '(goto) 2>nul & del "%~f0"',
  ].join('\r\n');
}

/** Lance l'installation détachée de l'app (elle survit à sa fermeture) ; l'appelant doit ensuite quitter. */
export function runInstaller(installer: string, appExe: string): void {
  const script = join(tmpdir(), 'plume-update', 'installer.cmd');
  writeFileSync(script, installScript(installer, appExe), 'utf8');
  spawn('cmd.exe', ['/c', script], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}
