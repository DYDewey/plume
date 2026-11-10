# Spec : auto-handoff

## Objectif
Ne pas laisser une conversation grossir jusqu'à ce que Claude devienne flou ou que le quota fonde.

## Comportement
- Quand le contexte de la session dépasse 70 % (`HANDOFF_THRESHOLD`), un bandeau apparaît au-dessus de la saisie : « Contexte à N %. … » + bouton « Faire la passation » (même flux que le bouton Passation) + croix « Plus tard ».
- Jamais pendant une réponse, ni pendant une passation déjà lancée.
- « Plus tard » : plus proposé pour cette session tant que l'app est ouverte.
- Réglage « Proposer une passation » (Claude), activé par défaut.

## Code
- `handoff-flow.ts` : `shouldSuggestHandoff` (pur, testé).
- `components/handoff-banner.tsx`.

## Pourquoi pas automatique sans demander
La passation remplace la session par un résumé : c'est à l'utilisateur de choisir le moment.
