# Spec : prompts

## Objectif
Réutiliser mes messages fréquents et retrouver mes skills sans me souvenir de leur nom.

## Comportement
- Bouton « Prompts et skills » dans la barre de saisie → panneau au-dessus, avec un filtre.
- Onglet « Mes modèles » : clic = ajouté à la suite du texte ; corbeille = supprimé ; « Enregistrer comme modèle » garde le texte de la saisie (titre = 1re ligne).
- Onglet « Skills et commandes » : liste envoyée par claude ; clic = `/nom ` placé devant le texte.
- Échap ou clic ailleurs : fermé.

## Stockage
`localStorage` (`mon-claude:prompts`, 200 modèles max), relu de façon tolérante (`parsePrompts`). Survit aux mises à jour de l'app (même dossier userData).

## Code
`shared/prompts.ts` (pur, testé), `components/prompts-panel.tsx`, `composer.tsx`.
