# Itqān — Controlled content batch 01

Ce paquet ajoute uniquement des fondations de contenu contrôlé. Il ne remplace pas l'interface existante.

## Installation dans le dépôt

Décompresser ce paquet à la racine du dépôt Itqān.

## Vérification sans dépendance

```bash
node scripts/validate-controlled-content.mjs
```

Résultat attendu :

```text
OK: 38 controlled Arabic item(s) passed integrity and verification checks.
```

## Contenu

- `public/content/verified/s110-batch01.json`
- `public/content/blueprints/units-batch01.json`
- `public/content/blueprints/vowels-sukun-batch01.json`
- `src/content/types.ts`
- `src/content/contentGuard.ts`
- `scripts/validate-controlled-content.mjs`
- `docs/CONTENT_AUDIT_BATCH_01.md`
