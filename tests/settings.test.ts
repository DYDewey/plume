import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from '../src/shared/settings';
import { loadSettings, saveSettings } from '../src/main/settings-store';

describe('parseSettings', () => {
  it('garde les valeurs valides', () => {
    const all = { theme: 'dark', textSize: 'large', sendKey: 'ctrl-enter', permissionMode: 'manual', showTechnical: true, notify: false, autoHandoff: false, autoArtifacts: false };
    expect(parseSettings(all)).toEqual(all);
  });

  it('remplace les valeurs inconnues par les défauts', () => {
    expect(parseSettings({ theme: 'rose', permissionMode: 'bypassPermissions', showTechnical: 'oui', notify: 1 })).toEqual(DEFAULT_SETTINGS);
  });

  it('accepte n’importe quoi sans planter', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('texte')).toEqual(DEFAULT_SETTINGS);
  });
});

describe('settings-store', () => {
  const dir = () => mkdtempSync(join(tmpdir(), 'mc-settings-'));

  it('fichier absent ou cassé : défauts', () => {
    const d = dir();
    expect(loadSettings(d)).toEqual(DEFAULT_SETTINGS);
    writeFileSync(join(d, 'settings.json'), '{ pas du json', 'utf8');
    expect(loadSettings(d)).toEqual(DEFAULT_SETTINGS);
  });

  it('un réglage enregistré survit au rechargement, les autres restent', () => {
    const d = dir();
    const saved = saveSettings(d, DEFAULT_SETTINGS, { theme: 'light', permissionMode: 'nimporte' });
    expect(saved).toEqual({ ...DEFAULT_SETTINGS, theme: 'light' });
    expect(loadSettings(d)).toEqual(saved);
    expect(JSON.parse(readFileSync(join(d, 'settings.json'), 'utf8')).theme).toBe('light');
  });
});
