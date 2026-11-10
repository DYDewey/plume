import { describe, expect, it } from 'vitest';
import { compareVersions, pickUpdate } from '../src/shared/update';

const hash = 'a'.repeat(64);
const release = (patch: Record<string, unknown> = {}, asset: Record<string, unknown> = {}) => ({
  tag_name: 'v0.3.0',
  draft: false,
  prerelease: false,
  body: 'Nouveautés',
  assets: [
    { name: 'latest.yml', browser_download_url: 'https://github.com/DYDewey/plume/releases/download/v0.3.0/latest.yml', size: 10, digest: `sha256:${hash}` },
    {
      name: 'Plume-Setup-0.3.0.exe',
      browser_download_url: 'https://github.com/DYDewey/plume/releases/download/v0.3.0/Plume-Setup-0.3.0.exe',
      size: 120_000_000,
      digest: `sha256:${hash}`,
      ...asset,
    },
  ],
  ...patch,
});

describe('compareVersions', () => {
  it('compare nombre par nombre, pas comme du texte', () => {
    expect(compareVersions('0.10.0', '0.9.9')).toBeGreaterThan(0);
    expect(compareVersions('v1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('0.2.0', '0.3.0')).toBeLessThan(0);
  });
});

describe('pickUpdate', () => {
  it('version plus récente avec son installeur et son empreinte', () => {
    expect(pickUpdate(release(), '0.2.0')).toEqual({
      version: '0.3.0',
      url: 'https://github.com/DYDewey/plume/releases/download/v0.3.0/Plume-Setup-0.3.0.exe',
      sha256: hash,
      size: 120_000_000,
      notes: 'Nouveautés',
    });
  });

  it('rien si pas plus récent, brouillon ou pré-version', () => {
    expect(pickUpdate(release(), '0.3.0')).toBeNull();
    expect(pickUpdate(release({ draft: true }), '0.2.0')).toBeNull();
    expect(pickUpdate(release({ prerelease: true }), '0.2.0')).toBeNull();
  });

  it('refuse un lien hors du dépôt ou sans empreinte sha256', () => {
    expect(pickUpdate(release({}, { browser_download_url: 'https://exemple.com/Plume-Setup-0.3.0.exe' }), '0.2.0')).toBeNull();
    expect(pickUpdate(release({}, { digest: undefined }), '0.2.0')).toBeNull();
    expect(pickUpdate(release({}, { digest: 'md5:abc' }), '0.2.0')).toBeNull();
  });

  it('réponse illisible : rien', () => {
    expect(pickUpdate(null, '0.2.0')).toBeNull();
    expect(pickUpdate({ message: 'Not Found' }, '0.2.0')).toBeNull();
  });
});
