# Spec : files

## Objectif
Voir d'un coup d'œil ce que Claude a changé dans mes fichiers à chaque réponse.

## Comportement
- Sous chaque réponse terminée qui a modifié des fichiers : carte « N fichiers modifiés +a −r ».
- Une ligne par fichier (nom, dossier, +/−), dépliable : diff ligne à ligne, lignes inchangées repliées (« … N lignes inchangées », 2 lignes de contexte), coupé au-delà de 400 lignes.
- Fichier `.html` / `.svg` écrit par Claude : bouton « Aperçu » → panneau d'artefact (voir `SPEC-artifacts.md`).
- Aussi dans l'historique relu.

## Source des diffs
Uniquement les entrées des outils (Edit, MultiEdit, Write, NotebookEdit) : **aucune lecture du disque**. Write = « créé » (ancien contenu inconnu, tout en +). Les Edit qui suivent un Write sont rejoués sur son contenu pour garder l'aperçu à jour ; si un remplacement ne s'applique pas, l'aperçu disparaît.

## Code
- `shared/file-changes.ts` : `lineDiff` (plus longue sous-suite commune, plafond 250 000 cases), `fileChanges`, `turnRanges`, `withContext`. Diff calculé une fois par élément (WeakMap) : pas de recalcul à chaque morceau de texte reçu.
- `components/files-card.tsx`, branché dans `chat-view.tsx`.
