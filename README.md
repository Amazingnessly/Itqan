# Itqān

Application d’apprentissage de la lecture arabe centrée sur la précision, la décomposition puis la fluidité.

## Principes

VOIR → DÉCOMPOSER → PRONONCER → FLUIDIFIER

L’application n’est pas un cours général d’arabe, de vocabulaire, de grammaire ou de Tajwid.

## Développement sans Codespaces

Le workflow courant repose sur GitHub + Codex + Cloudflare ; Codespaces n’est pas nécessaire.

```bash
npm install
npm run dev
```

Vérifications avant intégration :

```bash
npm run test:learning
npm run build
npm run cf:check
```

`npm run cf:check` construit l’application puis effectue un `wrangler deploy --dry-run` : aucun déploiement Cloudflare n’est effectué.

## Cloudflare

Le Worker est défini dans `worker/index.ts` et servi avec les assets Vite de `dist/` via `wrangler.jsonc`.

L’endpoint `/api/voice-assessment` est actuellement volontairement conservateur : il valide les entrées audio mais ne fournit aucun diagnostic de lecture faisant autorité tant qu’un fournisseur vocal arabe n’a pas été configuré et validé sur le corpus contrôlé Itqān.

## Garde-fous pédagogiques

- Le contenu arabe actif provient des données contrôlées et de leurs références.
- Les catégories restent verrouillées tant que les conditions de maîtrise ne sont pas satisfaites.
- Les observations vocales ne peuvent pas, seules, modifier la maîtrise ou débloquer une étape.
- Le CI vérifie le contenu contrôlé, les références, la progression, les invariants pédagogiques, le build et le bundle Cloudflare.

## Asset temporaire

`public/illustrations/family-reference-temp.jpeg` est un asset temporaire de prototypage fourni comme référence visuelle. Il devra être remplacé par une illustration finale Itqān sans texte visible dans l’image avant validation produit.
