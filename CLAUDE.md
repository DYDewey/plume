# Projet : Mon-Claude (app de bureau autour de Claude Code)

## Contexte et objectif
App de bureau gratuite qui pilote le CLI `claude` (abonnement, pas de clé API). Elle garde tout l'historique consultable, mais chaque nouvelle session après passation ne reçoit que le résumé.

## Périmètre
- Inclus : fenêtre de chat qui pilote `claude` en arrière-plan (réponses en flux) ; liste des anciennes conversations lues depuis `~/.claude/projects/` (lecture seule) ; bouton « Passation » : Claude rédige un résumé (skill garde-contexte), que je relis ou modifie avant d'ouvrir une session neuve qui ne reçoit que ce résumé.
- Exclu : clé API, services payants, synchro cloud, multi-utilisateurs, macOS/Linux.

## Contraintes
- Windows 11 uniquement. Electron + TypeScript.
- Zéro coût : uniquement le CLI `claude` déjà installé et connecté.
- Secours Gemini (interrupteur dans la barre latérale, activé par défaut) : `claude` est lancé via `node <ccr>/cli.js mix cli --` (claude-code-router, clé Gemini gratuite) ; ccr est démarré tout seul s'il dort, et l'app retombe sur `claude` direct s'il ne répond pas (`src/main/router.ts`). Profil `mix` : Opus/Sonnet/Haiku = vrais modèles Claude ; secours sur 429 = gemini-3.8-flash → 3.7-flash → 3.5-flash → 3.5-flash-lite (les Pro n'ont pas de quota gratuit). Le flux de claude garde le nom du modèle demandé : le badge du haut lit le vrai modèle dans le journal ccr (`src/main/router-log.ts`, `%APPDATA%\claude-code-router\request-logs.sqlite`, en-tête `x-claude-code-session-id`).
- Ne jamais modifier ni supprimer les fichiers d'historique de Claude Code.
- Ignorer node_modules, dist, build et les fichiers générés.

## Critères de réussite
- J'envoie un message et je vois la réponse s'afficher en direct.
- Mes skills perso fonctionnent dans l'app.
- Je peux rouvrir et relire n'importe quelle ancienne conversation.
- Après une passation, la nouvelle session ne contient que le résumé.
- Aucun appel payant.

## Façon de travailler
- Itérations courtes : un incrément livrable par étape, validation avant de continuer.
- Si une info manque, poser la question plutôt qu'inventer.
- Réponses concises, en français. Explications simples : je suis étudiant et j'apprends.

## Me conseiller les skills et commandes
- Quand un skill ou une commande (ex. /clear, /plan, /review, passation…) serait utile pour ce que je demande, propose-le-moi en une ligne, avec pourquoi. Je veux apprendre à mieux t'utiliser.
- Quand tu crées un CLAUDE.md pour un projet, ajoute-y toujours cette même règle.

## Vocabulaire
- Session : une conversation `claude` (un fichier .jsonl).
- Passation : résumé court, seul contexte d'une nouvelle session.
- main = processus Node/Electron ; renderer = interface.

## Hypothèses à confirmer
- Projet perso, sans échéance.
- `claude -p --output-format stream-json` suffit pour le chat.
- Le format des fichiers .jsonl reste stable.
