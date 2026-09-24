# Itqān — Instructions for coding agents

## Product purpose

Itqān is an Arabic reading mastery application. Its purpose is to build exact reading first, then fluency.

Core method:

**VOIR → DÉCOMPOSER → PRONONCER → FLUIDIFIER**

Do not turn the product into a general Arabic, vocabulary, grammar, or Tajwid course.

## Locked exercise categories

Only these categories are allowed in the active learning path:

1. `reading_units`
2. `vowels_sukun`
3. `shaddah`
4. `article_al`
5. `linking`
6. `fluent_reading`

The categories are fixed, but the learner-facing path has seven pedagogical stages because `article_al` is deliberately split around `shaddah`:

1. `reading_units`
2. `vowels_sukun`
3. `article_al` — qamariyyah phase
4. `shaddah`
5. `article_al` — shamsiyyah phase
6. `linking`
7. `fluent_reading`

The qamariyyah phase must not expose observed shaddah or shamsiyyah items. The shamsiyyah phase must stay locked until shaddah mastery. Do not collapse these phases merely to simplify category-level routing.

## Absolute Arabic-content rule

Arabic exercise content must come only from controlled manifests built from visually verified source scans.

Agents MUST NOT:

- invent Arabic strings;
- generate example words or sentences;
- add tashkīl from model knowledge;
- silently normalize Arabic;
- autocorrect source strings;
- copy Arabic from prompts, old assistant messages, UI mockups, or screenshots unless it already exists in a verified manifest;
- embed Arabic exercise strings directly inside React components or exercise blueprints.

Active lesson Arabic must resolve through:

`blueprint → itemId → verified manifest → arabicExact`

If a new Arabic string is required and no verified manifest item exists, stop that item only and report the missing source requirement.

## Source verification invariant

An Arabic item may be rendered in an active lesson only when all applicable guards pass, including:

- visual pass 1 = true;
- visual pass 2 = true;
- ambiguous = false;
- exercise category is authorized;
- content-integrity checks pass;
- item is explicitly eligible/active where required by the current engine.

Do not weaken or bypass these checks to make a build pass.

## Pedagogical rules

- Precision always outranks speed.
- Enforce progressive stage purity. Before `linking`, active material must remain an isolated controlled word; multi-word sequences are introduced only at `linking`, then extended in `fluent_reading`.
- `reading_units`: isolated controlled words only, with no observed Sukūn, no observed Shaddah and no observed definite-article class.
- `vowels_sukun`: isolated controlled words that exercise Sukūn, with no observed definite-article class and no observed Shaddah.
- `article_al` qamariyyah phase: isolated controlled words with observed qamariyyah article; no observed Shaddah or shamsiyyah leakage.
- `shaddah`: isolated controlled words that exercise Shaddah; do not leak shamsiyyah-article material before the dedicated shamsiyyah phase.
- `article_al` shamsiyyah phase: isolated controlled words with observed shamsiyyah article.
- Earlier mastered phenomena may remain present only when they do not obscure the new target; a phenomenon assigned to a later stage must never leak backward.
- Repetition must be pedagogically explicit: a deliberate reread, delayed verification or maintenance review. Do not use repeated itemIds as a substitute for corpus breadth. Maximize distinct verified item exposure across active sessions before scheduling a revisit.
- Do not infer beginner suitability from whitespace or token shape alone. Stage assignment must be supported by controlled manifest metadata and the verified source workflow.
- Within `reading_units`, the approved progressive-support substage order currently captured is: Fathah → Kasrah → Dammah → mixed short vowels → madd with Alif → limited madd with Ya → limited madd with Waw → mixed-madd consolidation. These are substages, not new exercise categories.
- Two-word material from the progressive support is reserved for `linking`; do not activate it inside `reading_units` merely because it appears next in the source support.
- Progressive-support source intake is complete for the material supplied by the human source holder. The recorded order after mixed madd is Tanwīn with Ḍamm, then Sukūn, both inside `vowels_sukun`; do not invent unprovided Tanwīn variants.
- The source screenshots are conversation uploads until repository-backed evidence is imported. Agents must not transcribe Arabic exercise strings from them. Exact Arabic entry remains a human-controlled step before visual pass 1/2, integrity hashing, eligibility, and activation.
- The approved human-controlled intake UI may package exact Arabic typed by the human source holder together with source-image bytes and verification metadata. That bundle is candidate source input only: agents may validate and deterministically promote the exact bytes, but MUST NOT rewrite, normalize, autocorrect, or linguistically reinterpret the Arabic during promotion.
- A single successful series is not mastery.
- Mastery requires repeated success across contexts and delayed review.
- Timing may measure reading, but speed cannot compensate for an error.
- Voice assessment is advisory until specifically validated for Itqān Arabic reading.
- Do not claim a specific Fathah/Kasrah/Dammah/Sukūn/Shaddah error unless the implemented assessment layer can support that diagnosis reliably.
- No punitive lives system.

Approved mastery labels:

- Découverte
- Progression
- Consolidation
- Maîtrise
- Excellence

Preferred wording: `point à renforcer`, `priorité`, `à consolider`, `prochain cap`.

Do not use “difficulté” as the level label.

## Visual direction

The UI is warm, luminous, elegant, mobile-first, premium and lightly vintage.

- white / warm-white base;
- warm storybook family illustrations;
- home, garden, kitchen, reading and library atmospheres;
- vintage character should mainly come from illustrations, not parchment-heavy UI;
- no text drawn inside illustrations;
- Arabic must remain large, clear, RTL and visually dominant during reading exercises;
- one main instruction at a time in a lesson;
- Accueil should not become a dense dashboard;
- Parcours should remain a genuine visual path rather than a stack of rectangular cards.

## Development workflow

Work on a branch and open a pull request. Do not push feature work directly to `main`.

Before proposing merge, run:

```bash
npm ci
node scripts/validate-controlled-content.mjs
node scripts/validate-batch02.mjs
node scripts/validate-blueprints-no-arabic.mjs
node scripts/validate-learning-engine-no-arabic.mjs
node scripts/validate-blueprint-crossrefs.mjs
node scripts/validate-active-session-policy.mjs
npm run validate:progressive-foundation
npm run validate:progressive-source-intake
npm run test:progressive-source-intake-ui
npm run test:activation-policy
node scripts/validate-ui-no-arabic-content.mjs
node scripts/validate-batch05-no-arabic.mjs
node scripts/validate-batch05-connections.mjs
node scripts/validate-batch06-no-arabic.mjs
node scripts/validate-batch06-visual-contract.mjs
npm run validate:v1-human-review
npm run test:v1-human-review
npm run test:v1-human-review-surface
npm run build
```

`validate:v1-human-review` checks only the integrity and coverage of the qualified-human review record. It must not be treated as linguistic approval. The release-only completion check is `npm run validate:v1-human-review-complete` and may pass only after qualified human evidence is recorded for every active session.

If a listed validator is intentionally superseded in a future PR, update this file and the CI workflow in the same PR with an explanation.

## Quality reporting

Use precise status language:

- verified;
- implemented but not tested;
- to verify;
- blocked by ambiguous source.

Never state that something works unless it was actually tested.
