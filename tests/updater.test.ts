import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkUpdate, downloadUpdate, installScript } from '../src/main/updater';

const bytes = new TextEncoder().encode('faux installeur');
const sha = createHash('sha256').update(bytes).digest('hex');
const info = { version: '9.9.9', url: 'https://github.com/DYDewey/plume/releases/download/v9.9.9/Plume-Setup-9.9.9.exe', sha256: sha, size: bytes.length, notes: '' };
const serve = (body: Uint8Array) => (async () => new Response(body as unknown as BodyInit)) as unknown as typeof fetch;

describe('téléchargement de la mise à jour', () => {
  it('empreinte identique : fichier gardé, progression jusqu’à 100 %', async () => {
    const seen: number[] = [];
    const path = await downloadUpdate(info, (r) => seen.push(r), serve(bytes));
    expect(readFileSync(path)).toEqual(Buffer.from(bytes));
    expect(seen.at(-1)).toBe(1);
  });

  it('empreinte différente : fichier supprimé, erreur', async () => {
    const other = new TextEncoder().encode('modifié!!!!!!!!');
    await expect(downloadUpdate({ ...info, version: '9.9.8' }, () => {}, serve(other))).rejects.toThrow(/empreinte/);
    expect(existsSync(join(tmpdir(), 'plume-update', 'Plume-Setup-9.9.8.exe'))).toBe(false);
  });
});

describe('vérification', () => {
  it('hors ligne ou erreur : rien', async () => {
    const fail = (async () => {
      throw new Error('hors ligne');
    }) as unknown as typeof fetch;
    expect(await checkUpdate('0.2.0', fail)).toBeNull();
  });
});

describe('script d’installation', () => {
  it('attend, installe en silencieux, relance l’app puis se supprime', () => {
    const s = installScript('C:\\T\\Plume-Setup-1.0.0.exe', 'C:\\A\\Plume.exe');
    expect(s).toContain('"C:\\T\\Plume-Setup-1.0.0.exe" /S');
    expect(s).toContain('start "" "C:\\A\\Plume.exe"');
    expect(s).toContain('del "%~f0"');
    expect(s).not.toContain('timeout');
  });
});
