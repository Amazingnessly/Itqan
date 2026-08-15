# Itqān — Batch 05 : progression et révision adaptative

## Objectif

Ce lot ne crée aucun nouveau contenu arabe. Il utilise uniquement les tentatives et états produits par le moteur existant.

## Changements

- Accueil : régularité calculée à partir des tentatives réelles.
- Parcours : niveau de maîtrise et précision réellement observée.
- Révision : priorité produite par le moteur adaptatif, pas une page statique.
- Profil : lectures exactes, durée de lecture mesurée, régularité et niveau actuel.
- Navigation : une reprise lancée depuis Révision revient vers Révision à la fin de la session.

## Limite volontaire

Pour le moment, seule la catégorie `reading_units` est déclarée active pour la révision UI. Les autres catégories restent visuellement verrouillées même si leurs blueprints existent, afin de ne pas donner accès à une étape avant activation produit explicite.

## Sécurité arabe

Batch 05 ne contient aucune chaîne arabe.

## Tests

```bash
node scripts/validate-batch05-no-arabic.mjs
node scripts/validate-batch05-connections.mjs
node scripts/validate-controlled-content.mjs
node scripts/validate-batch04-session.mjs
node scripts/validate-learning-engine-no-arabic.mjs
node scripts/validate-blueprint-crossrefs.mjs
node scripts/validate-ui-no-arabic-content.mjs
npm run build
```
