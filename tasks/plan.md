# Plan : modules restants + artefacts (2026-11-10)

Demande : « fais tout, comme la vraie application Claude, avec les artefacts ». Modules du SPEC encore à faire : `shortcuts`, `auto-handoff`, `files`, `prompts`, `export`, plus un nouveau module `artifacts`.

## Graphe de dépendances
```
T1 shortcuts ─────────────── (indépendant)
T2 auto-handoff ──> handoff existant (bouton Passation)
T3 files ─────────> items 'tool' (Edit/Write) déjà dans le chat
T4 artifacts ─────> blocs de code (message.tsx) ; T3 réutilise son « Aperçu » pour les .html/.svg
T5 prompts ───────> composer (texte de la saisie)
T6 export ────────> ChatItem[] (session ouverte et historique)
T7 docs + build + installation ──> tout
```

## Décisions
- **Aucune nouvelle dépendance.** Mermaid n'est pas installé : un bloc ```mermaid est affiché comme artefact, avec une page qui charge mermaid depuis le CDN jsdelivr (version fixée).
- **Artefacts** : servis par un protocole maison `artifact://` (main), avec leur propre CSP. L'iframe a `sandbox="allow-scripts"` (origine opaque : pas d'accès à l'app ni à Node). Une iframe `srcdoc` hériterait de la CSP de l'app, qui bloque les scripts : d'où le protocole. Réseau autorisé seulement vers les CDN (cdnjs, jsdelivr, unpkg) et Google Fonts ; `connect-src 'none'`.
- **Fichiers modifiés** : déduits des entrées des outils Edit / MultiEdit / Write (ancien et nouveau texte), sans lire le disque. Diff ligne à ligne maison (LCS), plafonné.
- **Passation auto** : bandeau au-dessus de la saisie quand le contexte dépasse 70 % (réglage, activé par défaut), masquable pour la session.
- **Notification** : envoyée par main à la fin d'une réponse si la fenêtre n'a pas le focus (réglage, activé par défaut). Clic : la fenêtre revient et la session s'affiche.
- **Prompts** : modèles enregistrés dans localStorage (confort, survit aux mises à jour) ; panneau dans la barre de saisie avec deux onglets : Modèles et Skills.
- **Export** : Markdown = fonction pure + boîte « Enregistrer sous ». PDF = `printToPDF` de la fenêtre, avec une feuille `@media print` qui ne garde que la conversation.

## Tâches
- T1 Raccourcis : Ctrl+N (nouvelle conversation), Ctrl+K (recherche), Ctrl+Tab / Ctrl+Maj+Tab (session suivante / précédente), notification Windows. Accept : tests des détecteurs de touches et de `nextSession`. Vérif : tests + CDP.
- T2 Passation auto : `shouldSuggestHandoff(context, threshold)`, bandeau + bouton. Accept : tests seuil + bandeau rendu. Vérif : tests.
- T3 Fichiers modifiés : `fileChanges(items)` par réponse + `lineDiff`, carte « N fichiers modifiés » dépliable. Accept : tests diff, regroupement Edit+Write du même fichier.
- T4 Artefacts : `artifactKind(lang, code)`, `artifactPage(kind, code)`, bouton « Aperçu » sur les blocs html/svg/mermaid, panneau à droite (Aperçu/Code, Copier, Enregistrer, Fermer). Accept : tests + capture CDP d'un artefact.
- T5 Prompts : `parsePrompts`, panneau, insertion dans la saisie, « Enregistrer comme modèle ». Accept : tests.
- T6 Export : `toMarkdown(title, items)`, IPC `export:markdown` / `export:pdf`, menu « Exporter » (session et historique). Accept : tests Markdown.
- T7 `SPEC-*.md` des modules, SPEC.md (ordre), build, installation, vérification CDP.

## Points de contrôle
- Après T2, T4 et T6 : `npm test`, `npm run typecheck`, `npm run lint`.
- À la fin : `npm run dist`, installation silencieuse, captures CDP clair/sombre.
