// Modèles proposés dans l'app : alias du CLI, qui pointent toujours vers la dernière version.
export type ModelChoice = 'opus' | 'sonnet' | 'haiku';

export const MODEL_CHOICES: { value: ModelChoice; label: string }[] = [
  { value: 'opus', label: 'Opus' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'haiku', label: 'Haiku' },
];

/** « Claude Code API/claude-sonnet-5-5 » → « claude-sonnet-5-5 » (préfixe du fournisseur ajouté par le routeur ccr). */
export function bareModel(model: string): string {
  return model.slice(model.lastIndexOf('/') + 1);
}

export function isModelChoice(value: unknown): value is ModelChoice {
  return MODEL_CHOICES.some((c) => c.value === value);
}
