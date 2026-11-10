import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_SETTINGS, parseSettings, type Settings } from '../shared/settings';

const FILE = 'settings.json';

/** Fichier absent ou cassé : réglages par défaut. */
export function loadSettings(dir: string): Settings {
  try {
    return parseSettings(JSON.parse(readFileSync(join(dir, FILE), 'utf8')));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Applique les champs valides de `patch` sur `current`, enregistre et renvoie le résultat. */
export function saveSettings(dir: string, current: Settings, patch: unknown): Settings {
  const next = parseSettings(patch && typeof patch === 'object' ? { ...current, ...patch } : current, current);
  writeFileSync(join(dir, FILE), JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}
