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
- The active `reading_units` foundation must use only its explicitly approved controlled itemId set. A string being unspaced or a single orthographic token is not sufficient evidence of beginner-level simplicity; attached units reported by qualified human review must remain excluded until deliberately reassigned through the controlled workflow.
- Do not pad a foundation session to an arbitrary interaction count by repeating controlled items. An active `reading_units` session must follow VOIR → DÉCOMPOSER → PRONONCER → FLUIDIFIER in exactly four interactions: the three approved foundation itemIds appear once each in the first three steps, then FLUIDIFIER may deliberately revisit exactly one already-seen item once. Further repetition needed for mastery must come from later sessions, multiple contexts and delayed review.
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
