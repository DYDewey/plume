# Plan : artefacts auto, panneau confortable, Auto plus malin, Ctrl+F et Réessayer (2026-11-10)

## Graphe de dépendances
```
A1 consigne artefacts (main, --append-system-prompt) ──> A2 ouverture auto en fin de réponse (renderer)
B1 panneau redimensionnable ──> B2 barre latérale repliée à l'ouverture (indépendant de A)
C  règles Auto (shared/auto-route.ts) ─── indépendant
D1 Ctrl+F dans la conversation ─── indépendant
D2 Réessayer (renvoie le dernier message) ─── indépendant
```

## Décisions
- **Consigne artefacts** : texte fixe ajouté à `--append-system-prompt` (avec les instructions de projet), seulement si le réglage « Artefacts automatiques » est actif (défaut : oui). Elle dit à Claude d'écrire une page HTML autonome, un SVG ou un Mermaid dans un bloc de code quand un visuel aide vraiment ; jamais pour du code à mettre dans un projet. Aucun appel en plus : c'est juste du texte dans la session.
- **Ouverture auto** : à la fin d'une réponse (passage running → idle) de la session affichée, si la réponse contient un artefact, il s'ouvre (le dernier). Pas pendant le flux : code incomplet.
- **Panneau** : poignée à gauche, glisser = largeur (320 px → 75 % de la fenêtre), retenue dans localStorage. À l'ouverture, la barre latérale se replie ; à la fermeture, elle revient si c'est le panneau qui l'avait repliée.
- **Auto** (5 décisions dans le journal, 2 erreurs) :
  - « Vas-y prépare tout… » : message de suite, le juge le voit sans contexte. Règle : un message de suite (« vas-y », « continue », « oui », « fais-le »…) garde le modèle en cours.
  - « J'aimerais qu'on travaille ensemble sur un projet » → Haiku : trop faible. Règle sûre Sonnet minimum pour un début de projet ou de travail.
- **Ctrl+F** : barre de recherche en haut de la conversation (ouverte ou relue), surligne les messages qui contiennent le texte, Entrée / Maj+Entrée = suivant / précédent, Échap ferme. Recherche dans les données (ChatItem), pas dans le DOM.
- **Réessayer** : bouton sous la dernière réponse de Claude (session ouverte, au repos) : renvoie le dernier message de l'utilisateur tel quel.

## Tâches
- T1 Consigne artefacts + réglage. Accept : `artifactInstructions` testée ; args contiennent la consigne seulement si réglage actif.
- T2 Ouverture auto. Accept : `lastArtifact(items)` testée.
- T3 Panneau redimensionnable + repli. Accept : `clampWidth` testée ; vérif CDP.
- T4 Règles Auto. Accept : tests sur les 5 messages du journal + `isContinuation`.
- T5 Ctrl+F. Accept : `findMatches` testée ; vérif CDP.
- T6 Réessayer. Accept : `lastUserText` testée, bouton rendu seulement au repos.
- T7 Tests, typecheck, lint, build, installation, CDP, commit, publication (avec accord).
