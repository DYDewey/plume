# Spec : updates

## Objectif
Plume se met à jour toute seule depuis GitHub, sans dépendance (pas d'electron-updater) et sans relancer l'installeur à la main.

## Comportement
- App installée : vérification 15 s après le démarrage, puis toutes les 6 h. En dev : seulement le bouton « Rechercher une mise à jour » (Paramètres › Général, avec la version installée).
- Nouvelle version trouvée : bouton « Mettre à jour (x.y.z) » dans la barre de titre. Désactivé pendant une réponse de Claude.
- Clic : téléchargement (progression dans le bouton) → vérification → petit script `.cmd` détaché qui attend 2 s, lance l'installeur en silencieux (`/S`), relance `Plume.exe` et se supprime ; l'app se ferme.

## Sécurité
- Source unique : `api.github.com/repos/DYDewey/plume/releases/latest` ; brouillons et pré-versions ignorés.
- L'installeur doit s'appeler `Plume-Setup-<version>.exe`, venir de `https://github.com/DYDewey/plume/releases/download/` et avoir une empreinte `sha256` publiée par GitHub (champ `digest` de l'asset). Sans empreinte : pas de mise à jour.
- Le fichier téléchargé est haché au fil de l'eau : empreinte ou taille différente → fichier supprimé, erreur affichée. Plafond 400 Mo.
- Le renderer ne choisit ni l'adresse ni le fichier : il demande seulement « installer ce que main a trouvé ».

## Publier une version
1. Monter la version : `npm version x.y.z --no-git-tag-version`, commit.
2. `npm run dist` → `release/Plume-Setup-x.y.z.exe`.
3. `gh release create vx.y.z release/Plume-Setup-x.y.z.exe --repo DYDewey/plume --title "Plume x.y.z" --notes "…"` (action publique : avec accord).

## Limite connue
L'installeur contient l'identifiant interne `fr.moi.mon-claude` (appId) : le changer casserait la mise à jour par-dessus l'installation actuelle.

## Code
`shared/update.ts` (pur : `compareVersions`, `pickUpdate`), `main/updater.ts` (`checkUpdate`, `downloadUpdate`, `installScript`, `runInstaller`), `registerUpdateIpc` dans `main/ipc.ts`, `title-bar.tsx`, `settings-view.tsx`.
