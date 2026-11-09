import { isModelSetting, type ModelSetting } from '../../shared/auto-route';
import type { ModelChoice } from '../../shared/model';

// Dernier modèle choisi (ou « Auto »), retenu entre deux lancements de l'app. Absent : « Par défaut ».
const KEY = 'mon-claude:model';

export function readLastModel(storage: Pick<Storage, 'getItem'>): ModelSetting | undefined {
  try {
    const value = storage.getItem(KEY);
    return isModelSetting(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function writeLastModel(storage: Pick<Storage, 'setItem' | 'removeItem'>, model: ModelSetting | undefined): void {
  try {
    if (model) storage.setItem(KEY, model);
    else storage.removeItem(KEY);
  } catch {
    // stockage indisponible : le choix ne sera pas retenu, sans gravité
  }
}

/** Modèle à passer à claude au lancement : en Auto, Sonnet en attendant le 1er message (qui décidera). */
export function launchModel(setting: ModelSetting | undefined): ModelChoice | undefined {
  return setting === 'auto' ? 'sonnet' : setting;
}
