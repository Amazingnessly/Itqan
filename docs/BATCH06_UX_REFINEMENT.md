# Itqān — Batch 06 : refinement visuel et rythme d'usage

## Objectif

Améliorer la continuité visuelle sans modifier le corpus pédagogique.

## Changements

- Accueil : accès discret au Parcours sous le CTA principal.
- Leçon : affichage explicite de la méthode VOIR → DÉCOMPOSER → PRONONCER → FLUIDIFIER.
- Leçon : progression calculée sur l'item actuellement affiché.
- Leçon : hiérarchie plus nette entre consigne, arabe contrôlé et action.
- Révision / Profil : surfaces plus cohérentes avec l'identité premium Itqān.
- Mobile : prise en charge de `safe-area-inset-bottom`.
- Accessibilité : animations neutralisées avec `prefers-reduced-motion`.
- Dépôt : les futurs dossiers `_batchXX` et ZIP de lots sont ignorés pour éviter l'accumulation de fichiers temporaires.
- Aperçu : ajout d'un script unique `scripts/preview-itqan.sh`.

## Arabe

Aucune nouvelle chaîne arabe n'est introduite.
La zone de lecture continue d'utiliser `current.arabicExact`, résolu depuis le manifeste contrôlé.

## Vérifications

```bash
node scripts/validate-batch06-no-arabic.mjs
node scripts/validate-batch06-visual-contract.mjs
node scripts/validate-controlled-content.mjs
node scripts/validate-batch04-session.mjs
node scripts/validate-learning-engine-no-arabic.mjs
node scripts/validate-blueprint-crossrefs.mjs
node scripts/validate-ui-no-arabic-content.mjs
npm run build
```
