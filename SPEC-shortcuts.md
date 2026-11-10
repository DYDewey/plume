# Spec : shortcuts

## Objectif
Tout faire au clavier et savoir quand Claude a fini sans regarder la fenêtre.

## Comportement
- Ctrl+N : nouvelle conversation (choix du dossier). Ctrl+K : curseur dans la recherche de l'historique (déplie la barre latérale si besoin).
- Ctrl+Tab / Ctrl+Maj+Tab : conversation ouverte suivante / précédente, en boucle. Depuis l'historique, les paramètres ou un projet : va à la première (ou dernière).
- Déjà là : Ctrl+B (barre latérale), Ctrl+, (paramètres), Échap.
- Notification Windows « Claude a répondu » (début de la réponse, sans Markdown, 140 caractères max) à chaque fin de réponse **si la fenêtre n'a pas le focus**. Clic : la fenêtre revient et affiche la session. Réglage « Notification de fin de réponse » (Général), activé par défaut.

## Code
- `ui-format.ts` : `isCtrlLetter`, `tabDirection`, `neighborSession` (purs, testés dans `tests/shortcuts.test.ts`).
- `app.tsx` : un seul écouteur clavier en capture ; une ref garde les actions à jour.
- `main/ipc.ts` : `notifyDone` (Electron `Notification`), `shared/notify.ts` : texte. `app.setAppUserModelId` = appId de l'installeur, sinon Windows n'affiche rien.

## Limites
- En dev (`electron.exe` non installé), Windows peut ignorer les notifications : tester avec l'app installée.
