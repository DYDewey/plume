# Spec : module continue

Validée le 28/10/2026. Index : `SPEC.md`.

## Objectif
Reprendre une ancienne conversation là où elle s'est arrêtée, depuis la vue d'historique. Aujourd'hui on peut seulement la relire.

## Fonctionnement
1. Bouton **« Continuer »** dans l'en-tête de la vue d'historique (à côté de « Lecture seule »).
2. Clic : l'app lance `claude --resume <ancien id> --fork-session --session-id <nouvel id>` dans le dossier de la session. Claude a tout le contexte, mais la suite va dans une **nouvelle session** : l'ancien `.jsonl` n'est jamais modifié (décision du 28/10).
3. La nouvelle session s'ouvre comme un onglet normal (saisie, permissions, modèle), avec les anciens messages déjà affichés au-dessus.
4. Comme toute session : instructions du projet envoyées si le dossier est un projet, dernier modèle choisi.
5. Dossier de la session introuvable (supprimé, déplacé) : bouton désactivé, infobulle « Dossier introuvable ».
6. La copie apparaît ensuite dans l'historique comme une session à part.

## Vérifié avec le CLI 2.1.312 (28/10)
`--resume X --fork-session --session-id Y` : session Y créée avec le contexte de X, X inchangée.

## Découpage
- `src/main/claude-args.ts` : option `forkFrom` → `--resume <forkFrom> --fork-session --session-id <id>`.
- `src/main/session-manager.ts`, `ipc.ts`, `preload`, `api.ts` : `startSession(cwd, { forkFrom })` ; `forkFrom` vérifié côté main (format d'identifiant).
- Renderer : bouton dans `history-view.tsx` ; `app.tsx` ouvre l'onglet avec les messages déjà lus.

## Tests
- Arguments construits pour une copie ; `forkFrom` invalide refusé.
- Bouton présent, désactivé si dossier absent.
- Vraie app : continuer une vieille session, demander « de quoi parlait-on ? », Claude répond juste ; empreinte de l'ancien `.jsonl` inchangée.

## Hors périmètre
- Continuer dans le même fichier (`--resume` simple).
- Continuer une session dont le dossier n'existe plus.

## Modifier un message (2026-11-10)
- Au survol d'un de tes messages (conversation ouverte au repos, ou ancienne conversation dont le dossier existe) : « Modifier ». Zone d'édition en place ; Entrée envoie, Échap annule.
- La conversation repart d'une copie arrêtée à la dernière réponse de Claude avant ce message : `--resume <id> --fork-session --resume-session-at <uuid> --session-id <nouveau>` (option cachée du CLI, vérifiée avec claude 2.1.321 : la copie oublie bien la suite). Puis le nouveau texte est envoyé.
- `uuid` : celui de la ligne `assistant` du .jsonl, identique dans le flux en direct (vérifié) ; gardé sur les éléments `assistant` / `tool` (`history-parser`, événement `checkpoint` du `stream-parser`).
- Premier message modifié : conversation neuve dans le même dossier. Conversation ouverte : la copie remplace l'onglet ; l'original reste intact sur le disque (historique).
