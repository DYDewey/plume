# Spec : module packaging

Validée et terminée le 25/10/2026. Index : `SPEC.md`.

## Objectif
Transformer l'app en vraie appli Windows : un installeur `Setup.exe`, une icône sur le Bureau et dans le menu Démarrer, un lancement en un clic sans `npm` ni terminal.

## Fonctionnement
1. **Commande `npm run dist`** : elle compile l'app (`electron-vite build`), puis la met en paquet avec **electron-builder** (gratuit, open source, ajouté en devDependency). Le résultat va dans `release/` (ignoré par git) : `Mon-Claude-Setup-0.1.0.exe`.
2. **Installeur NSIS « en un clic »** : installation pour l'utilisateur courant seulement, sans droits administrateur, dans `%LOCALAPPDATA%\Programs\mon-claude`.
   - Il crée un raccourci « Mon-Claude » sur le Bureau et dans le menu Démarrer, et lance l'app à la fin.
   - L'app apparaît dans Paramètres > Applications, d'où on peut la désinstaller. La désinstallation ne touche jamais à `~/.claude/` (historique de Claude Code).
3. **Icône** : générée par un petit script Node (lettre « C » blanche sur un fond coloré, 256×256) et enregistrée dans `resources/icon.png` (versionnée ; `build/` est ignoré par git), qui sert pour l'installeur, le .exe, les raccourcis et la barre des tâches. On pourra la remplacer en changeant juste ce fichier.
4. **Trouver `claude`** : l'app lancée depuis le raccourci reçoit le PATH de l'utilisateur, où se trouve `C:\Users\moi\.local\bin\claude.exe`. Rien à changer : `spawn('claude')` marche déjà, et s'il échoue, le message « Commande « claude » introuvable » s'affiche déjà. À vérifier dans l'app installée.
5. **Données de l'app** (dernier modèle choisi, etc.) : elles restent dans `%APPDATA%\mon-claude`, comme en développement.

## Découpage
- `package.json` : script `dist`, champs `build` (appId `fr.moi.mon-claude`, productName `Mon-Claude`, cible `nsis`, `directories.output: release`, fichiers inclus = `out/**` et `package.json`, `directories.buildResources: resources`).
- `resources/logo.svg` : logo (plume). `npx electron scripts/render-logo.mjs` le dessine dans un canvas et écrit `resources/icon.png` (512×512), sans dépendance.
- `.gitignore` : ajout de `release/`.
- Rien à changer dans `src/`, sauf si la vérification du point 4 révèle un problème.

## Hors périmètre
Signature du code (payante), mise à jour automatique, version portable, macOS/Linux, publication sur GitHub Releases, installation pour tous les utilisateurs.

## Critères de réussite
- `npm run dist` produit `release/Mon-Claude-Setup-0.1.0.exe` sans erreur.
- Je lance le Setup → l'app s'installe sans demander de droits admin, les raccourcis Bureau et menu Démarrer sont là, avec l'icône.
- Un double-clic sur le raccourci ouvre l'app, sans terminal. J'envoie un message et je vois la réponse en direct (donc `claude` est bien trouvé), et mes skills perso marchent.
- L'historique s'affiche et la passation fonctionne dans l'app installée.
- Désinstallation depuis Paramètres → l'app et les raccourcis disparaissent, et `~/.claude/projects/` est intact.
- `npm test`, `typecheck`, `lint` restent verts.

## À savoir
- Le .exe n'est pas signé : au premier lancement du Setup, Windows SmartScreen affiche « Windows a protégé votre ordinateur ». Il faut cliquer sur « Informations complémentaires » puis « Exécuter quand même ». C'est normal pour une app perso.

## Questions ouvertes
- electron-builder accepte-t-il `electron-vite` 6 / Electron 45 sans réglage spécial ? À vérifier au premier `dist`.
