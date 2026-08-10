# Itqān — Audit de contenu contrôlé — Batch 01

## État

**Vérifié :** 38 segments arabes.

**Source :** support S110, fichier canonique `المبدأ في التعبير والانشاء لغة2 الجزء1 (2)(1).pdf`.

**Pages contrôlées dans ce lot :**
- page PDF 3 — page imprimée 1 ;
- page PDF 21 — page imprimée 19.

Chaque segment de ce lot a été vérifié :
1. sur la page scannée complète ;
2. sur un agrandissement de la même zone.

Aucune normalisation Unicode n'est appliquée. Un SHA-256 UTF-8 est enregistré pour détecter une altération silencieuse de la chaîne.

## Statut d'activation

Les éléments sont **éligibles** à une leçon active, mais le champ `active` reste volontairement `false` tant que la première leçon n'a pas passé son propre contrôle UX/pédagogique.

## Volume pédagogique préparé

- 12 micro-séances « Unités de lecture » × 10 interactions = **120 interactions**.
- 12 micro-séances « Voyelles / Sukūn » × 10 interactions = **120 interactions**.

Total du premier lot : **240 interactions planifiées**, sans créer une seule nouvelle chaîne arabe.

Les interactions réutilisent les mêmes chaînes vérifiées sous des gestes différents : balayage, lecture exacte, suivi d'unités, lecture orale, contraste entre items réellement présents dans le corpus, relecture de précision et contrôle différé.

## Audio

Les chaînes de ce lot ne possèdent pas d'audio source attaché. Elles restent utilisables pour le visuel, la lecture par l'utilisateur et le chronométrage. Un futur audio de référence devra être enregistré ou généré puis validé avant de devenir un modèle de prononciation.

## Support de 384 pages — exercice audio

La page PDF 24 du support S384 fournit un modèle d'exercice de discrimination auditive, mais pas les mots audio eux-mêmes dans le scan. Itqān peut reprendre **le geste pédagogique** de discrimination auditive avec des chaînes provenant de ce manifeste contrôlé ; aucun mot manquant ne sera inventé à partir de la page audio.

## Règle d'intégrité

Une leçon doit résoudre son arabe par `itemId`. Le blueprint d'exercice ne doit jamais contenir une variante arabe créée à la volée.
