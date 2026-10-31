// Événements envoyés du main au renderer pour une session claude.
export type BridgeEvent =
  | { type: 'text-delta'; sessionId: string; text: string }
  | { type: 'tool-use'; sessionId: string; name: string; input: Record<string, unknown> }
  | { type: 'turn-end'; sessionId: string; result?: string; costUsd?: number }
  | { type: 'error'; sessionId: string; message: string }
  /** Commandes et skills disponibles (« / »), envoyés par claude au démarrage. */
  | { type: 'commands'; sessionId: string; names: string[] }
  /** Modèle réellement utilisé par la session (ex. claude-opus-5-5), envoyé par claude au démarrage. */
  | { type: 'model'; sessionId: string; model: string }
  /** Qui a vraiment répondu au dernier tour (journal du routeur ccr) : Claude, ou Gemini en secours. */
  | { type: 'responder'; sessionId: string; provider: string; model: string }
  /** Jauges de l'abonnement, les mêmes pour toutes les sessions. */
  | { type: 'rate-limits'; sessionId: string; fiveHour?: LimitWindow; sevenDay?: LimitWindow }
  /** Taille du contexte de la session : `used` tokens sur `max`. */
  | { type: 'context'; sessionId: string; used: number; max: number }
  /** Prochain message que l'utilisateur pourrait envoyer, proposé par claude après chaque tour. */
  | { type: 'suggestion'; sessionId: string; text: string };

export interface LimitWindow {
  /** Part utilisée, de 0 à 1. */
  utilization: number;
  /** Remise à zéro, en secondes Unix. */
  resetsAt: number;
}
