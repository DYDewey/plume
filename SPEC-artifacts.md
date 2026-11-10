# Spec : artifacts

## Objectif
Comme dans l'app Claude : voir en vrai les pages, images et diagrammes que Claude écrit.

## Comportement
- Bloc de code `html`, `svg` (ou `xml` qui commence par `<svg`) ou `mermaid` dans une réponse → carte « titre · type · N lignes » au lieu du code.
- Clic → panneau à droite : Aperçu / Code, Copier, Enregistrer, Fermer. Fermé quand on change de conversation.
- Aussi depuis la carte des fichiers modifiés (fichier `.html` / `.svg` écrit par Claude).

## Sécurité
- La page est confiée au main (`artifact:show`, 5 Mo max), gardée en mémoire (50 dernières) et servie par le protocole `artifact://view/<uuid>`.
- Iframe `sandbox="allow-scripts allow-popups allow-modals"`, **sans** `allow-same-origin` : origine opaque, aucun accès à l'app, au preload ni à Node.
- CSP propre à la page (`ARTIFACT_CSP`) : scripts et styles inline + CDN cdnjs / jsdelivr / unpkg / Google Fonts, `connect-src 'none'` (le script ne peut rien envoyer), `form-action 'none'`.
- Pourquoi pas `srcdoc` : il hériterait de la CSP de l'app (`default-src 'self'`), qui bloque tout script.
- CSP de l'app : `frame-src artifact:` ajouté. Liens « nouvelle fenêtre » : ouverts dans le navigateur (`setWindowOpenHandler`), jamais dans l'app.

## Mermaid
Pas de dépendance npm : la page charge `mermaid@11.4.1` (version fixée) depuis jsdelivr. Hors ligne : le diagramme ne s'affiche pas (le code reste visible dans l'onglet Code).

## Code
`shared/artifacts.ts`, `main/artifact-store.ts`, `main/index.ts` (protocole), `artifact-context.ts`, `components/artifact-card.tsx`, `components/artifact-panel.tsx`, `message.tsx`.
