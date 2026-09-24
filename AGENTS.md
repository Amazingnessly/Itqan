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

Arabic exercise content may enter active lessons only through controlled manifests built from visually verified source evidence.

Agents MUST NOT:

- invent Arabic strings;
- generate example words or sentences from model knowledge;
- add tashkīl from model knowledge;
- silently normalize Arabic;
- autocorrect source strings;
- promote OCR/model transcription directly into a controlled manifest;
- embed Arabic exercise strings directly inside React components or exercise blueprints.

For the canonical progressive source, an agent MAY create a **provisional transcription candidate** from the source image/PDF solely inside the controlled source-intake review workflow. Such a candidate is explicitly non-authoritative and MUST remain inactive until a qualified human has checked the exact string against the source in two visual passes, marked ambiguity false, and the source evidence is repository-backed. The human reviewer may correct the candidate; the corrected exact bytes become the candidate for promotion. Human retyping from scratch is not required.

Active lesson Arabic must still resolve through:

`blueprint → itemId → verified manifest → arabicExact`

If a new Arabic string has not completed the human-verification gate, stop that item only and keep it outside active manifests.

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
- The canonical progressive PDF is the source of record for this intake wave. The reading-support portion is pages 22–62; do not turn the surrounding Tajwid chapters into learner curriculum.
- After mixed madd, the source-led `vowels_sukun` intake order is Tanwīn with Fatḥah → Tanwīn with Kasrah → Tanwīn with Ḍammah → mixed Tanwīn consolidation → Sukūn. These remain internal substages, not new locked exercise categories.
- The PDF also contains a later Shaddah source block. Import only item-level material that satisfies the locked Shaddah-stage purity rules; do not leak article/shamsiyyah material backward.
- The canonical PDF is currently conversation-backed until repository evidence import is completed. Provisional transcription candidates may be generated for review, but they are never authoritative by themselves.
- The verification UI should prefill provisional candidates when available so the qualified human’s normal task is comparison/correction and approval, not manual retyping. Two visual passes remain mandatory before promotion.
- Promotion MUST preserve the exact human-approved bytes and MUST NOT rewrite, normalize, autocorrect, or linguistically reinterpret the Arabic.
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
