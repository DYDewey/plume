/** Nom exact du modèle qui a répondu au dernier tour ; mis en avant quand ce n'est pas Claude (secours). */
export function ResponderBadge({ responder }: { responder?: { provider: string; model: string } }) {
  if (!responder) return null;
  const fallback = !/claude/i.test(responder.provider);
  return (
    <span
      className={`responder-badge${fallback ? ' fallback' : ''}`}
      title={fallback ? `Quota Claude épuisé : réponse de secours par ${responder.provider}` : `Réponse de ${responder.provider}`}
    >
      {fallback ? 'Secours : ' : ''}
      {responder.model}
    </span>
  );
}

/** Interrupteur du secours Gemini (routeur ccr). Vaut pour les sessions lancées ensuite. */
export function RouterToggle({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  return (
    <label
      className="router-toggle muted"
      title="Quand le quota Claude est épuisé, les réponses passent par Gemini (clé gratuite). Si le routeur ne répond pas, claude est lancé directement. S'applique aux nouvelles sessions."
    >
      <input type="checkbox" checked={enabled} onChange={(e) => onChange(e.target.checked)} />
      Secours Gemini
    </label>
  );
}
