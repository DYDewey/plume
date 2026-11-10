# Spec : module auto-model

Validée le 09/11/2026 (« fais ce que tu penses le mieux »). Index : `SPEC.md`. Dépend de : model, cli-bridge.

## Objectif
Choix « Auto » dans la liste des modèles : avant chaque message, l'app choisit Haiku, Sonnet ou Opus (toujours la dernière version via les alias) selon la demande, pour économiser le quota sans perdre en qualité.

## Fonctionnement
1. **Règles locales** (`src/shared/auto-route.ts`, fonctions pures) : beaucoup de motifs (code, fichiers, erreurs, verbes d'action → Opus ; salutations, définitions, traductions, calculs simples → Haiku ; explications, rédaction, conseils → Sonnet). Chaque règle donne un modèle, une raison et « sûre » ou non.
2. **Juge à chaque message** : Gemini 3.5 Flash-Lite, appelé via la passerelle ccr (`Google Gemini/gemini-3.5-flash-lite`, jeton du profil `mix`). La clé Gemini reste dans ccr, l'app ne la lit jamais. Zéro token Claude, ~1 s. Réponse attendue : un seul mot.
3. **Décision** :
   - le juge l'emporte, sauf si une règle sûre demande plus fort (jamais moins fort qu'une règle sûre : mieux vaut trop fort que réponse débile) ;
   - juge absent (ccr coupé, quota Gemini, délai 4 s dépassé, réponse illisible) → règles seules ;
   - commandes `/…` → on garde le modèle en cours (Sonnet s'il n'y en a pas) ;
   - **cache** : changer de modèle fait relire tout l'historique sans cache. Si le contexte dépasse 40 000 tokens, on ne descend plus (on peut toujours monter).
4. Si le modèle choisi diffère de celui de la session : relance `--resume … --model X` (module model), puis envoi.
5. Le bouton affiche « Auto · Opus » ; l'infobulle et le menu donnent la raison et la source (règles / juge / gardé).
6. Journal local `%APPDATA%/mon-claude/auto-route.jsonl` : date, 80 premiers caractères, règle, juge, choix final. Sert à améliorer les règles.

## Hors périmètre
Juge Claude (coûte du quota), niveau d'effort, choix par projet.

## Critères de réussite
- « salut ça va » → Haiku ; « explique la photosynthèse » → Sonnet ; « corrige le bug dans app.tsx » → Opus.
- ccr arrêté : l'app choisit quand même (règles) et rien ne bloque.
- Tests Vitest : règles (FR/EN), lecture de la réponse du juge, décision (sûre, sans juge, cache, commandes).

## Ajustements d'après le journal (2026-11-10)
Journal `auto-route.jsonl` : 5 décisions le 09/11, 2 mauvaises.
- « J'aimerais qu'on travaille ensemble sur un projet » → Haiku (juge). Nouvelle règle **sûre** Sonnet « travail sur un projet » (projet, travailler ensemble, on s'y met…) : le juge ne descend plus en dessous.
- « Vas-y prépare tout pour que je puisse le tester » : le juge lit le message sans la conversation. `isContinuation` reconnaît les relances courtes (vas-y, continue, oui, fais-le, je te laisse faire…, ≤ 120 caractères) : le modèle en cours est gardé (source « gardé »), sans appeler le juge. Exception : une règle sûre plus forte (ex. une trace d'erreur collée) l'emporte.
- Tests : `tests/auto-route-journal.test.ts` rejoue les 5 messages. À refaire quand le journal aura plus de lignes.
