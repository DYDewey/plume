# Spec : module organize

Brouillon du 25/10/2026, à valider. Index : `SPEC.md`.

## Objectif
Retrouver vite les conversations importantes : les mettre en **favoris** (étoile) et leur donner un **nom à moi**. « Épingler » (idée 2) et « favoris » (idée 10) sont le même système. Les fichiers `.jsonl` de Claude Code ne sont jamais modifiés : tout est rangé dans un fichier propre à l'app.

## Fonctionnement
1. **Étoile** : au survol d'une session de l'historique, une icône étoile (lucide `Star`) apparaît ; un clic l'ajoute ou la retire des favoris. Une session favorite garde son étoile pleine (orange) en permanence. Même bouton dans l'en-tête quand on relit une session de l'historique.
2. **Section « Favoris »** dans la barre latérale, entre « En cours » et « Historique » : les sessions favorites, de la plus récente à la plus ancienne, avec le nom du projet en petit. Un clic les ouvre en lecture comme dans l'historique. Section cachée s'il n'y a aucun favori.
3. **Renommer** : au survol, une icône crayon (lucide `Pencil`) ; un clic transforme le titre en champ de saisie. Entrée valide, Échap annule, un nom vide remet le titre d'origine. Même action dans l'en-tête de la relecture.
4. Le nom personnalisé remplace le titre partout : historique, favoris, en-tête, et la **recherche** de la barre latérale (`filterHistory`) cherche dans ce nom.
5. **Persistance** : `%APPDATA%/Mon-Claude/organize.json` (dossier `userData` d'Electron), lu au démarrage, réécrit à chaque changement. Le module `projects` réutilisera ce fichier.
   ```json
   { "version": 1, "sessions": { "<dossier>/<id>": { "favorite": true, "title": "Promesses JS" } } }
   ```
6. **Robustesse** : fichier absent → vide ; fichier illisible ou JSON invalide → l'app démarre quand même avec des favoris vides et ne réécrit pas par-dessus (copie `organize.json.bak` avant la première écriture). Un favori dont le `.jsonl` a disparu est simplement masqué (gardé dans le fichier).

## Hors périmètre
- Favoris et renommage des sessions **en cours** (onglet « En cours ») : elles apparaissent dans l'historique dès qu'on le rafraîchit, c'est là qu'on les range.
- Suppression de sessions, dossiers ou étiquettes de couleur (les projets viendront avec `projects`).
- Synchronisation entre ordinateurs.

## Découpage
- `src/shared/organize.ts` : types (`OrganizeData`, `SessionMeta`), fonctions pures `toggleFavorite`, `renameSession` (nom vide = suppression du champ), `displayTitle(session, meta)`, `favoriteSessions(projects, data)`, `parseOrganize(text)` (valide et nettoie le JSON).
- `src/main/organize-store.ts` : lecture et écriture atomique (fichier temporaire puis `rename`), copie `.bak`.
- `src/main/ipc.ts` + `src/preload/index.ts` + `src/shared/api.ts` : `getOrganize()` et `setOrganize(data)`.
- Renderer : `history-list.tsx` (étoile, crayon, champ de renommage), nouvelle `favorites-list.tsx`, en-tête de `history-view.tsx`, `app.tsx` (état + sauvegarde), `ui-format.ts` (`filterHistory` reçoit les noms personnalisés).

## Tests
- Vitest, fonctions pures dans `tests/organize.test.ts` : basculer un favori, renommer puis remettre à vide, `displayTitle`, tri des favoris, `parseOrganize` sur JSON invalide / version inconnue / champs en trop.
- `organize-store` testé sur un dossier temporaire : aller-retour, fichier corrompu → vide + `.bak`, écriture atomique.
- Composants avec `renderToStaticMarkup` : étoile pleine pour un favori, section « Favoris » cachée si vide, titre personnalisé affiché ; logique clavier du renommage en fonction pure (`renameKey`).
- Vérification dans la vraie app (CDP) : mettre en favori, renommer, redémarrer l'app, tout est encore là.

## Limites
- Toujours : tests avant chaque commit, un commit par tâche, aucune écriture dans `~/.claude/`.
- Demander d'abord : toute nouvelle dépendance, tout changement du format de `organize.json` après validation.
- Jamais : modifier ou supprimer un `.jsonl`, appel payant.

## Critères de réussite
- Je mets une session en favori, elle apparaît dans « Favoris » ; je la retire, elle disparaît.
- Je renomme « Explique-moi les promesses… » en « Promesses JS » : le nouveau nom s'affiche partout, et la recherche « promesses js » la trouve.
- Après un redémarrage de l'app, favoris et noms sont toujours là.
- Les `.jsonl` de `~/.claude/projects/` ont le même contenu et la même date de modification avant et après.
- Les 162 tests existants restent verts.

## Questions ouvertes
1. Section « Favoris » : liste plate (proposée) ou regroupée par projet ?
2. Renommage : par le crayon au survol (proposé), ou aussi par double-clic sur le titre ?

## Masquer (2026-11-10)
- Bouton « Masquer » (au survol d'une ligne de l'historique) : `hidden: true` dans organize.json. Rien n'est supprimé.
- Les masquées vont dans un groupe replié « Masquées (n) » en bas de l'historique (bouton « Réafficher »), et ne sont plus dans « Récentes » ni la recherche par titre.
- Les conversations sans dossier (`%APPDATA%\mon-claude\discussions`) s'affichent « Discussion » au lieu du nom de dossier.
