# Spec : module ui

Validée le 25/10/2026. Index : `SPEC.md`.

## Objectif
Rendre l'interface aussi soignée que Claude Desktop (sobriété, typographie, espacements, icônes), en gardant l'identité de Mon-Claude : gris foncé + orange `#d97757`, logo « C » orange. Aucune fonctionnalité existante ne change de comportement.

## Fonctionnement
1. **Thèmes** : sombre (l'actuel, peaufiné) et clair (crème chaud, façon Desktop). L'app suit le réglage de Windows (`prefers-color-scheme`) et bascule en direct quand on le change. Toutes les couleurs passent par des variables CSS (`--bg`, `--panel`, `--text`, `--muted`, `--accent`, `--border`…) redéfinies par thème ; plus aucune couleur en dur dans les règles. Le thème de coloration du code (highlight.js) suit aussi : clair ou sombre.
2. **Typographie** : interface en Segoe UI ; réponses de Claude avec empattements (`Cambria, Georgia, serif`, polices déjà dans Windows, rien à télécharger), interligne 1,65 ; code en Cascadia Code puis Consolas. Échelle de tailles fixe (12 / 13 / 15 / 17 / 24 px).
3. **Icônes** : `lucide-react` (SVG, open source) remplace tous les emojis et symboles : 📎 trombone, 📝 passation, 📖 lecture seule, ↻ rafraîchir, × fermer, + nouvelle session, et les icônes des lignes d'outils (Read, Edit, Write, Bash, Grep…). Chaque bouton qui n'a qu'une icône a un `aria-label` et une infobulle.
4. **En-tête** : titre de la session, puis seulement le nom du dossier (`mon-claude`), chemin complet en infobulle. À droite : % de contexte, badge « Lecture seule » (historique) et bouton « Passation » discret (icône + texte, sans fond orange).
5. **Modèle** : le `<select>` quitte l'en-tête. Il devient un petit menu déroulant maison dans la barre de saisie, à côté du trombone : il affiche le modèle choisi (« Par défaut », « Opus »…) et, dans le menu, le modèle réellement utilisé. Clavier : flèches, Entrée, Échap. Même comportement qu'aujourd'hui (changer relance `claude`, la conversation continue).
6. **Barre latérale** :
   - plus aérée (260 px), bouton « Nouvelle session » sobre (icône +, sans fond orange plein) ;
   - deux sections titrées : « En cours » et « Historique » ;
   - **recherche** en haut de l'historique : filtre par titre de session et nom de projet, sans tenir compte des majuscules ni des accents ; les projets qui correspondent s'ouvrent ; « Aucun résultat » sinon ;
   - **repliable** : bouton dans la barre et Ctrl+B ; l'état est retenu d'un lancement à l'autre ;
   - jauges plus compactes en bas ; la session en cours de réponse a un point orange qui pulse.
7. **Accueil** (aucune session ouverte) : au centre, le logo « C », « Bonjour, que fait-on ? » et le bouton « Nouvelle session ».
8. **Dialogue de passation** : coins arrondis, ombre, fond flouté ; texte en police d'interface, boutons « Annuler » (secondaire) et « Ouvrir une session neuve » (principal) ; Échap annule.
9. **Finitions** : boutons en trois variantes (principal orange, secondaire, icône) ; anneau de focus orange visible au clavier ; barres de défilement fines ; légers fondus (150 ms) à l'apparition des messages, menus et dialogues, coupés si Windows demande moins d'animations (`prefers-reduced-motion`).

## Inchangé (hors périmètre)
- Disposition des messages et de la zone de saisie (bulles, largeur, textarea, étiquettes de pièces jointes) : seuls les couleurs, les polices et les icônes s'y appliquent, plus le menu du modèle (point 5).
- Tout le processus main, le preload et la logique (sessions, historique, passation, usage).
- Choix manuel du thème dans l'app, polices téléchargées, renommage ou suppression de sessions.

## Découpage
- `src/renderer/src/styles.css` : variables par thème, échelle typo, variantes de boutons, finitions. Thème highlight.js clair et sombre.
- Dépendance ajoutée : `lucide-react` (seule nouvelle dépendance).
- Fonctions pures testées : `filterHistory(projects, query)` (normalise accents et casse) et `folderLabel(path)` (dernier dossier du chemin).
- Composants : `sidebar.tsx` (sections, repli), `history-list.tsx` (recherche), `model-picker.tsx` (menu maison, déplacé dans `composer.tsx`), en-têtes de `app.tsx` et `history-view.tsx`, `handoff-dialog.tsx`, `tool-line.tsx`, nouvel écran `welcome.tsx`.

## Critères de réussite
- En basculant Windows en clair ou sombre, l'app change de thème sans redémarrer, et tout reste lisible (contraste AA, vérifié sur captures des deux thèmes).
- Plus aucun emoji ni symbole Unicode servant d'icône dans l'interface.
- Taper « passa » dans la recherche ne laisse que les sessions dont le titre contient « passa » ou « Passation ».
- Ctrl+B replie et déplie la barre latérale ; l'état survit à un redémarrage.
- Le modèle se choisit depuis la barre de saisie, à la souris et au clavier, et relance bien `claude`.
- Les 115 tests existants restent verts ; nouveaux tests Vitest : `filterHistory`, `folderLabel`, menu du modèle (ouverture, choix, Échap), repli de la barre, écran d'accueil.
- Vérification dans la vraie app (CDP) : captures avant/après, thème clair et sombre, sans erreur dans la console.

## Décisions
- Colonne de lecture centrée (~760 px) : non en V1 ; oui depuis la refonte du 2026-11-09 (voir « Refonte 2026-11 » ci-dessous).

## Refonte 2026-11 (plan : `tasks/plan.md`)
- Barre de titre maison (`titleBarStyle: 'hidden'` + `titleBarOverlay` aux couleurs du thème), plus de menu Electron ; F12 = outils de dev, en dev seulement.
- Paramètres (`settings-view.tsx`, ⚙ ou Ctrl+, , Échap) enregistrés par main dans `settings.json` (`settings-store.ts`, validation champ par champ) : thème (`nativeTheme.themeSource`), taille du texte (`data-text-size`), touche d'envoi, mode d'autorisation (`auto` par défaut, `acceptEdits`, `manual` ; jamais `bypassPermissions`), sessions techniques visibles ou non. Le secours Gemini y a déménagé (toujours `router.json`).
- Historique rangé par date (`history-groups.ts`), tous projets mêlés ; titre + « dossier · heure » ; sessions techniques masquées (claude-mem, dossiers `AppData\Local\Temp`).
- Conversation : colonne centrée (768 px), bulles utilisateur, blocs de code avec langage + bouton Copier (`message.tsx`), indicateur « Claude réfléchit », barre de saisie flottante qui grandit.
- Ancienne conversation : la saisie est directement disponible ; écrire la reprend dans une copie (`--fork-session`) et envoie le message. Plus de bouton « Continuer ».
- Titre automatique (`auto-title.ts`, `auto-title-flow.ts`) : après chaque réponse, le juge Gemini (via ccr, jamais Claude) propose un titre de 2 à 6 mots, ou « AUCUN » si le but n'est pas clair (3 essais max). Enregistré comme renommage dans `organize.json` ; un renommage manuel n'est jamais remplacé ; une conversation reprise n'est titrée qu'après un nouveau message.
- Libellés : « Nouvelle conversation », « Ouvertes » ; titres de section en casse normale.
