# Spec : export

## Objectif
Garder une conversation hors de l'app (cours, rapport, partage).

## Comportement
- Bouton « Exporter » (icône téléchargement) dans la barre du haut d'une session ouverte ou relue → Markdown ou PDF.
- Boîte « Enregistrer sous » (dossier Documents, nom = titre sans caractères interdits). Petit message en bas : chemin enregistré ou erreur.
- Markdown : titre, date, « ## Toi » / « ## Claude » en entier, outils résumés en liste, erreurs en citation.
- PDF : impression de la page (`printToPDF`, A4) avec une feuille `@media print` qui cache barres, saisie, panneaux et détails des outils.

## Code
- `shared/export.ts` : `toMarkdown`, `exportFileName`, `cleanFileName` (testés).
- `main/ipc.ts` : `registerExportIpc` (`export:save-text`, `export:pdf`). Le renderer ne choisit jamais le chemin : seulement un nom proposé.
