# Spec : Mon-Claude

App de bureau Windows gratuite qui pilote le CLI `claude` (abonnement, pas de clé API).
Elle garde tout l'historique consultable ; après une passation, la nouvelle session ne reçoit que le résumé.

## Carte des modules (validée le 2026-10-24)

| Module | Rôle | Dépend de |
|---|---|---|
| `cli-bridge` | (main) lance `claude`, lit le flux JSON, envoie les événements au renderer | — |
| `chat` | (renderer) fenêtre de chat, affichage en direct | cli-bridge |
| `usage` | jauges abonnement (5 h / 7 jours) + % de contexte de chaque session + suggestion de réponse | cli-bridge, chat |
| `history` | liste et relit les `.jsonl` de `~/.claude/projects/`, lecture seule | — |
| `handoff` | Passation : résumé → relecture/édition → nouvelle session avec ce résumé seul | cli-bridge, chat |
| `model` | choisir le modèle (Opus, Sonnet…) d'une session et le changer à tout moment | cli-bridge, chat |
| `auto-model` | choix « Auto » : règles + juge Gemini gratuit (via ccr) choisissent Haiku/Sonnet/Opus avant chaque message | model, cli-bridge |
| `attachments` | joindre des fichiers (photos, PDF, code…) à un message : bouton, glisser-déposer, coller une capture | cli-bridge, chat |
| `packaging` | vraie appli Windows : installeur, icône sur le bureau / menu Démarrer, lancement en un clic sans ligne de commande | tous |
| `ui` | refonte visuelle façon Claude Desktop : thèmes clair/sombre, typo, icônes SVG, barre latérale (recherche, repli), accueil | chat, history, handoff, model |
| `organize` | favoris (étoile) et renommage des sessions, rangés dans `organize.json` de l'app | history, ui |
| `projects` | projets : dossier de travail qui regroupe ses sessions + instructions et fichiers envoyés à chaque nouvelle session | organize, chat |
| `search` | recherche plein texte dans le contenu des anciennes conversations | history, organize |
| `continue` | reprendre une ancienne conversation dans une copie (`--fork-session`), l'ancien .jsonl reste intact | history, chat |
| `permissions` | demandes de permission du CLI affichées dans le chat (Autoriser / Toujours / Refuser) | chat |
| `shortcuts` | raccourcis clavier (Ctrl+N, Ctrl+K, Ctrl+Tab) + notification Windows quand une réponse finit | chat, ui |
| `prompts` | panneau des skills/commandes + modèles de messages réutilisables, insérés dans la saisie | chat |
| `auto-handoff` | passation proposée automatiquement au-delà d'un seuil de contexte | usage, handoff |
| `files` | fichiers modifiés par Claude à chaque réponse, avec aperçu des changements | chat |
| `export` | exporter une conversation en Markdown ou PDF | history |
| `artifacts` | pages HTML, SVG et diagrammes Mermaid de Claude affichés dans un panneau à droite (iframe isolée, protocole `artifact://`) | chat, files |

Ordre : `cli-bridge` ✅ → `chat` ✅ → `usage` ✅ → `history` ✅ → `handoff` ✅ → `model` ✅ → `attachments` ✅ → `packaging` ✅ → `ui` ✅ → `organize` ✅ → `projects` ✅ → `search` ✅ → `continue` ✅ → `permissions` ✅ → `shortcuts` ✅ → `prompts` ✅ → `auto-handoff` ✅ → `files` ✅ → `export` ✅ → `auto-model` ✅ → `artifacts` ✅ (ajouté le 2026-11-10). (8 derniers ajoutés le 2026-10-25 ; `ui` ajouté le 2026-10-25 ; `usage` et `packaging` ajoutés le 2026-10-24, `model` aussi.)
Chaque module a sa spec : `SPEC-<module>.md`. Ce fichier est l'index.

## Objectif
- Utilisateur : moi seul, étudiant, Windows 11, CLI `claude` déjà installé et connecté.
- J'envoie un message et je vois la réponse s'afficher en direct.
- Mes skills perso fonctionnent dans l'app.
- Je peux rouvrir et relire n'importe quelle ancienne conversation.
- Après une passation, la nouvelle session ne contient que le résumé.
- Aucun appel payant.

## Tech stack
- Electron + TypeScript, outillage `electron-vite`
- Renderer : React
- Tests : Vitest
- Node 24, npm 11, Claude Code 2.1.x

## Commandes
```
Installer :  npm install
Dev :        npm run dev          (electron-vite dev)
Build :      npm run build        (electron-vite build)
Tests :      npm test             (vitest run)
Typecheck :  npm run typecheck    (tsc --noEmit)
Lint :       npm run lint         (eslint .)
```

## Structure
```
src/main/        → processus Electron (Node) : cli-bridge, lecture history, stockage passations
src/preload/     → pont sécurisé main ↔ renderer (contextBridge)
src/renderer/    → interface React
src/shared/      → types partagés (événements, messages)
tests/           → tests Vitest (+ tests/fixtures/ : extraits de flux et de .jsonl)
```

## Style de code
- TypeScript `strict`, pas de `any`.
- Fichiers en kebab-case, composants React en PascalCase, fonctions en camelCase.
- Commentaires en français, courts, seulement quand le « pourquoi » n'est pas évident.
- Le renderer n'a jamais accès direct à Node : tout passe par le preload.

```ts
// src/shared/events.ts
export type BridgeEvent =
  | { type: 'text-delta'; sessionId: string; text: string }
  | { type: 'turn-end'; sessionId: string; costUsd?: number }
  | { type: 'error'; sessionId: string; message: string };
```

## Stratégie de test
- Vitest pour la logique pure : parsing du flux stream-json, lecture des `.jsonl`, construction des arguments CLI.
- Fixtures réelles (copies anonymisées) dans `tests/fixtures/`.
- L'interface est vérifiée à la main, avec une checklist par module.
- Aucun test n'appelle le vrai `claude` (pas de consommation d'abonnement en test).

## Limites
- Toujours : lancer `npm test` et `npm run typecheck` avant de dire qu'une étape est finie ; un incrément livrable à la fois, validé avant le suivant.
- Demander d'abord : ajouter une dépendance ; changer le mode de permission ; toucher à `~/.claude/settings.json`.
- Jamais : modifier ou supprimer un fichier de `~/.claude/projects/` ; utiliser une clé API ou un service payant ; synchro cloud.

## Décisions
- Permissions dans le chat : réglage « Autorisations » (`auto` par défaut depuis le 2026-11-09 ; avant `acceptEdits`, trop de demandes).
- Dossier de travail : choisi à chaque nouvelle conversation.
- Passations stockées dans `%APPDATA%/mon-claude/handoffs/`, jamais dans `~/.claude`.

## Questions ouvertes
- Le format des `.jsonl` reste-t-il stable ? (à vérifier dans `history`)
