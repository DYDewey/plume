# Spec : module usage (+ suggestion de réponse)

Validée le 24/10/2026. Index : `SPEC.md`.

## Objectif
Voir d'un coup d'œil ce qu'il reste sur l'abonnement et à quel point chaque session est pleine.
En plus (demandé le 24/10) : comme dans le terminal, Claude propose une suggestion de prochain message.

## Sources (déjà dans le flux de `claude`, aucun appel en plus)
- **Jauges abonnement** : `rate_limit_event.rate_limit_info.unifiedWindows.{five_hour,seven_day}` → `utilization` (0 à 1), `resetsAt` (secondes Unix).
- **% de contexte** : tokens du dernier message `assistant` (`input_tokens + cache_read_input_tokens + cache_creation_input_tokens + output_tokens`) / `result.modelUsage[<modèle de ce message>].contextWindow`.
- **Suggestion** : option `--prompt-suggestions true` + variable d'env `CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION=1` (sans elle, rien en mode `-p`, vérifié le 24/10, CLI 2.1.310). Après chaque `result`, une ligne `{"type":"prompt_suggestion","suggestion":"…"}`. Utilise un peu de quota d'abonnement, aucun coût.

## Affichage
- Bas de la barre latérale : « 5 h : 38 % · reset 16h00 » et « 7 jours : 53 % · reset sam. 14h00 », avec une barre.
- Chaque session (barre latérale) et en-tête du chat : « Contexte : 23 % ».
- Couleurs : vert < 70 %, orange 70–90 %, rouge ≥ 90 %.
- Dernières jauges gardées en localStorage ; au démarrage, en gris avec « il y a X min » jusqu'à la prochaine réponse.
- Suggestion : en gris dans la zone de saisie vide ; **Tab** la recopie (modifiable avant envoi). Elle disparaît dès qu'on envoie un message.

## Hors périmètre
Coût en $, historique/graphiques, notifications système, passation automatique (module handoff).

## Critères de réussite
- Après une réponse, les deux jauges et le % de contexte s'affichent et correspondent au flux.
- Au redémarrage de l'app, les jauges réapparaissent (grisées) avant tout message.
- Après une réponse, une suggestion apparaît ; Tab la met dans la zone de saisie.
- Tests Vitest sur le parser, le reducer et les calculs (%, couleur, heure de reset).

## Jauges au lancement (2026-11-10)
- Au démarrage puis toutes les 5 min : `GET https://api.anthropic.com/api/oauth/usage` (même source que `/usage` de Claude Code, en-tête `anthropic-beta: oauth-2025-04-20`). Aucun message envoyé, aucun quota consommé.
- Jeton : `~/.claude/.credentials.json`, **lu seulement**, utilisé s'il reste valable au moins 1 min. Jamais renouvelé ni écrit (sinon la connexion de Claude Code changerait). Expiré ou hors ligne : on garde les jauges en cache, mises à jour à la 1re réponse comme avant.
- L'API donne des pourcentages (81.0) et des dates ISO : convertis en 0..1 et secondes Unix (`shared/usage-api.ts`, testé).
