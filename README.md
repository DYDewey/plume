# Plume

App de bureau Windows gratuite autour du CLI [Claude Code](https://docs.claude.com/en/docs/claude-code). Elle pilote `claude` en arrière-plan avec ton abonnement : pas de clé API, aucun appel payant.

## Fonctionnalités

- **Chat en direct** : la réponse s'affiche au fil de l'eau ; tes skills et commandes perso (`/ma-commande`) marchent comme dans le terminal.
- **Historique** : toutes les anciennes conversations de `~/.claude/projects/`, regroupées par dossier et relisibles en lecture seule (les fichiers ne sont jamais modifiés).
- **Passation** : Claude rédige un résumé de la session, tu le relis ou le modifies, puis une session neuve démarre avec ce résumé pour seul contexte.
- **Choix du modèle** (Opus, Sonnet, Haiku), modifiable en cours de session.
- **Jauges** : utilisation de l'abonnement (5 h / 7 jours) et pourcentage de contexte de la session.
- **Pièces jointes** : bouton 📎, glisser-déposer, ou Ctrl+V d'une capture d'écran ou d'un fichier copié.

## Prérequis

- Windows 11
- [Claude Code](https://docs.claude.com/en/docs/claude-code) installé et connecté (`claude` doit marcher dans un terminal)
- Pour développer : Node.js 22 ou plus récent

## Installation

```bash
git clone https://github.com/DYDewey/mon-claude.git
cd mon-claude
npm install
npm run dist
```

L'installeur est créé dans `release/Plume-Setup-<version>.exe`. Il installe l'app pour ton utilisateur seul, avec un raccourci sur le Bureau et dans le menu Démarrer. La désinstallation (Paramètres → Applications) ne touche pas à ton historique Claude Code.

## Développement

| Commande | Rôle |
|---|---|
| `npm run dev` | lance l'app en mode développement (rechargement à chaud) |
| `npm test` | tests unitaires (Vitest) |
| `npm run typecheck` | vérification des types TypeScript |
| `npm run lint` | ESLint |
| `npm run build` | compile dans `out/` |
| `npm run dist` | compile et crée l'installeur Windows |

## Comment ça marche

Electron + React + TypeScript, construit avec electron-vite.

- `src/main/` (processus Node) : lance `claude -p --output-format stream-json`, lit le flux d'événements (`stream-parser.ts`, `session-manager.ts`), lit l'historique (`history-reader.ts`) et enregistre les passations (`handoff-store.ts`).
- `src/preload/` : expose au renderer une API limitée (`window.claude`).
- `src/renderer/` : l'interface React.
- `src/shared/` : types et fonctions partagés.

Les spécifications de chaque module sont dans `SPEC.md` et `SPEC-*.md`.

## Licence

[MIT](LICENSE)
