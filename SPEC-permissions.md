# Spec : module permissions

Validée le 28/10/2026. Index : `SPEC.md`.

## Objectif
Quand Claude veut faire une action qui demande une permission (commande Bash, accès web, fichier hors du dossier…), me demander dans le chat au lieu de refuser en silence.

## Constat (CLI 2.1.312, vérifié le 28/10)
- Aujourd'hui : `--permission-mode acceptEdits`. Les modifications de fichiers du dossier passent toutes seules ; le reste est refusé automatiquement, sans me demander.
- Avec `--permission-prompt-tool stdio`, le CLI envoie sur stdout :
  `{"type":"control_request","request_id":…,"request":{"subtype":"can_use_tool","tool_name":"Bash","input":{…},"description":…,"permission_suggestions":[…]}}`
  et attend une réponse `control_response` sur stdin.

## Fonctionnement
1. Une demande s'affiche comme une **carte dans le chat** : outil, commande ou fichier concerné, description. Trois boutons :
   - **Autoriser** : cette fois seulement.
   - **Toujours autoriser** : cette fois, et la règle proposée par Claude est enregistrée (voir question 1).
   - **Refuser** : Claude reçoit « Refusé par l'utilisateur » et continue autrement.
2. Tant que la carte attend, la zone de saisie reste utilisable ; « Arrêter » ou fermer l'onglet annule la demande (refus).
3. Une fois répondue, la carte reste dans le fil, réduite : « Bash autorisé » / « refusé ».
4. Onglet en arrière-plan avec une demande en attente : pastille sur l'onglet.
5. Le mode `acceptEdits` ne change pas : seules les actions qui auraient été refusées en silence sont désormais demandées.

## Découpage
- `claude-args.ts` : ajouter `--permission-prompt-tool stdio`.
- `stream-parser.ts` : `control_request` / `can_use_tool` → événement `permission-request`.
- `session-manager.ts` + IPC : `answerPermission(sessionId, requestId, decision)` écrit la `control_response` ; `requestId` et `decision` vérifiés côté main ; demandes en attente refusées à l'arrêt.
- Renderer : `permission-card.tsx`, état des demandes dans le reducer de session, pastille d'onglet.

## Tests
- Parseur : `control_request` → événement ; autres `control_request` ignorés.
- Réponses écrites sur stdin (faux claude) : autoriser, toujours, refuser ; `requestId` inconnu ignoré.
- Composant : carte en attente / répondue.
- Vraie app : demander `curl …` → carte → Autoriser → la commande s'exécute ; Refuser → Claude le dit.

## Décisions (28/10/2026)
1. « Toujours autoriser » : règle écrite par le CLI dans `.claude/settings.local.json` du dossier de travail (jamais `~/.claude/settings.json`).
2. Mode `acceptEdits` gardé ; on ajoute seulement `--permission-prompt-tool stdio`.

## Écarts à l'implémentation (07/11/2026, CLI 2.1.319)
- Saisie désactivée pendant qu'une carte attend, comme pendant toute réponse (`running`) : « Stop » et les boutons de la carte restent actifs. Le point 2 du fonctionnement n'est donc pas appliqué pour la saisie.
- Les outils qui attendent une vraie réponse (`requires_user_interaction`, ex. `AskUserQuestion`) n'ont pas de carte : main répond à Claude de poser sa question dans le chat.
- Toute règle proposée par le CLI est ramenée à `localSettings` ; les suggestions qui ne sont pas des règles d'autorisation (`setMode`…) sont ignorées.
