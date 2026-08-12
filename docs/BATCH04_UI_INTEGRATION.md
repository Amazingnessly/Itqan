# Itqān — Batch 04 : première session fonctionnelle

## Portée

Ce lot branche le moteur pédagogique Batch 03 sur l'interface React.

La première micro-séance active est `UNITS-B01-S01`, soit dix interactions de la catégorie **Unités de lecture**.

## Rigueur de contenu

Le texte arabe affiché par `LessonPage` n'existe pas dans le composant React. Il est résolu au runtime :

`blueprint → itemId → manifeste contrôlé → arabicExact`

Le script d'activation refuse d'activer un item qui n'est pas :
- vérifié visuellement deux fois ;
- non ambigu ;
- éligible ;
- autorisé pour `reading_units`.

## Interaction actuelle

La reconnaissance vocale n'est **pas simulée**.

Le flux est :
1. consigne unique ;
2. observation du texte ;
3. démarrage de lecture ;
4. chronométrage invisible ;
5. fin de lecture ;
6. auto-contrôle explicite « Exact / À reprendre » ;
7. une réponse « À reprendre » maintient le même item ;
8. une réponse « Exact » permet de continuer.

Cette auto-évaluation est provisoire et clairement indiquée dans l'interface. Elle sera remplacée ou complétée seulement après validation d'un moteur vocal suffisamment fiable.

## Chronométrage

Mesuré sans affichage pendant la lecture :
- préparation ;
- lecture ;
- total ;
- reprises.

La vitesse n'est jamais utilisée pour corriger une erreur ou débloquer une compétence.

## Persistance

`localStorage` conserve :
- les tentatives ;
- le profil de maîtrise ;
- l'index de la session.

## Activation

Le manifeste Batch 01 reste la source de vérité. Seuls les 10 items utilisés par la session pilote sont passés à `active: true`.

## Tests exigés avant commit

```bash
node scripts/activate-batch04-pilot.mjs
node scripts/validate-controlled-content.mjs
node scripts/validate-batch04-session.mjs
node scripts/validate-learning-engine-no-arabic.mjs
node scripts/validate-blueprint-crossrefs.mjs
node scripts/validate-ui-no-arabic-content.mjs
npm run build
```


Aucun accès microphone n'est demandé dans ce lot : la lecture est orale mais l'évaluation reste manuelle.
