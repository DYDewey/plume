const BODY_MAX = 140;

/** Début de la réponse, sans la mise en forme Markdown, pour le texte de la notification Windows. */
export function notificationBody(result: string | undefined): string {
  const plain = (result ?? '')
    .replace(/```[^]*?```/g, ' [code] ')
    .replace(/[`*_#>|]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return 'La réponse est prête.';
  const chars = [...plain];
  return chars.length > BODY_MAX ? chars.slice(0, BODY_MAX - 1).join('') + '…' : plain;
}
