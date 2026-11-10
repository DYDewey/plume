# Plan : finitions + mises à jour automatiques + modifier un message + dépôt « plume » (2026-11-10)

## Graphe de dépendances
```
P1 modèle sur l'accueil ───────────── indépendant
P2 actions sous les réponses ──┐
G3 modifier un message ────────┴─> même rangée d'actions (Copier / Réessayer / Modifier)
P3 miniatures ─────────────────────── main (nativeImage) + CSP img-src data:
P4 masquer + « Discussion » ───────── organize.json (champ hidden)
G4 renommer le dépôt ──> G1 mises à jour (l'adresse des Releases utilise le nouveau nom)
```

## Décisions
- **P1** : le menu du modèle (même composant) dans la barre de saisie de l'accueil ; il règle le « dernier modèle » utilisé par la prochaine conversation.
- **P2** : sous chaque réponse de Claude, au survol : Copier (texte Markdown de la réponse). Sous la dernière : Réessayer (déjà là) toujours visible.
- **P3** : main fait une miniature (`nativeImage`, 96 px) en data URL ; CSP de l'app : `img-src 'self' data:`. Fichier non image : icône comme avant.
- **P4** : `hidden: true` dans organize.json (rien sur le disque de Claude Code n'est touché). Bouton « Masquer » sur chaque ligne de l'historique ; les masquées vont dans un groupe repliable « Masquées (n) » en bas, avec « Réafficher ». Les conversations du dossier `discussions` sont marquées « Discussion » au lieu du nom de dossier.
- **G3** : option cachée du CLI `--resume-session-at <uuid>` (reconnue par claude 2.1.321) : reprise d'une copie de la conversation jusqu'au dernier message de Claude avant le message modifié, puis envoi du nouveau texte. Les `uuid` viennent des lignes `assistant` (flux en direct et .jsonl). Premier message modifié : conversation neuve dans le même dossier. L'ancienne session reste intacte sur le disque (historique) ; dans l'app, la copie remplace l'onglet. À vérifier une fois en vrai (petit test Haiku).
- **G4** : `gh repo rename plume` (GitHub redirige l'ancien lien) ; `publier.sh` et README pointent vers le nouveau nom.
- **G1** : sans dépendance. Main interroge `api.github.com/repos/DYDewey/plume/releases/latest` au démarrage puis toutes les 6 h ; version plus récente (semver) avec un `Plume-Setup-x.y.z.exe` → bandeau « Plume x.y.z est disponible ». « Mettre à jour » : téléchargement dans le dossier temporaire, vérification sha256 (champ `digest` de GitHub, obligatoire), puis un petit script lance l'installeur en silencieux, attend la fin et relance Plume ; l'app se ferme. Jamais pendant une réponse en cours (bouton désactivé). Version passée à 0.2.0. Publier une Release reste une action manuelle (`gh release create`), avec accord.

## Tâches
- T1 P1 modèle sur l'accueil
- T2 P2 Copier sous les réponses
- T3 P3 miniatures (IPC `files:thumb`)
- T4 P4 masquer / réafficher + étiquette Discussion
- T5 G3 modifier un message (uuid dans stream-parser et history-parser, args, flux)
- T6 G4 renommer le dépôt
- T7 G1 mises à jour (`shared/update.ts` pur et testé : comparaison de versions, choix de l'asset ; `main/updater.ts`)
- T8 vérifs, installation, commit, publication (avec gardien-push)

## Points de contrôle
Tests + typecheck + lint après T4, T5, T7 ; captures CDP ; test réel de G3 avec Haiku (quelques messages courts).
