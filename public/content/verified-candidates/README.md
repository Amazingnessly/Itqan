# Progressive verified candidates

This directory is a staging area for deterministic outputs from the qualified-human progressive verification workflow.

Files here are **not active lesson manifests**. Promotion requires:

- a module-scoped human verification bundle;
- exact UTF-8 integrity hashes;
- two completed visual passes;
- explicit non-ambiguity;
- canonical source identity and SHA-256 match;
- repository-backed source evidence whose bytes match the canonical source hash.

Generated items remain `eligibleForActiveLesson: false` and `active: false` until source-supported feature metadata, category policy checks, session design, and the normal activation gates are completed.

Use:

```bash
node scripts/progressive-human-verification-promotion.mjs \
  <verification.json> \
  public/content/verified-candidates/<module>.json
```
