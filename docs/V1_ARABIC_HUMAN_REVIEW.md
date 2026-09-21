# Itqān V1 qualified Arabic review checklist

This document prepares the human-only release gate tracked by #152. It is a review record, not a substitute for qualified Arabic validation.

No row below is evidence of approval while its status remains `PENDING QUALIFIED HUMAN REVIEW`.

The generated [`V1_HUMAN_REVIEW_SURFACE.md`](generated/V1_HUMAN_REVIEW_SURFACE.md) expands these 21 rows into every active interaction, with the exact controlled `arabicExact`, item ID, source page, integrity hash, visual-pass state, exercise settings, and evidence state. Generate it with `npm run generate:v1-human-review-surface` and verify that it is current with `npm run test:v1-human-review-surface`. Every interaction must expose both visual-evidence links or an explicit blocking marker; a session containing such a marker must not be marked `VERIFIED BY QUALIFIED HUMAN`. It remains supporting material only: qualified-human outcomes and evidence references belong in the matrix below.

## Reviewer record

- Release candidate SHA: `PENDING`
- Reviewer name or traceable reviewer ID: `PENDING`
- Reviewer qualification/context relevant to Arabic reading instruction: `PENDING`
- Review date: `PENDING`
- Overall outcome: `PENDING QUALIFIED HUMAN REVIEW`

## Required review procedure

For every active session below, the qualified reviewer must inspect every interaction through the controlled source chain:

1. Resolve the session in its listed blueprint and resolve each `itemId` through the listed verified manifest.
2. Check the manifest's canonical source/page evidence against the source scan; do not normalize, silently edit, substitute, or reconstruct Arabic.
3. Verify the exact written Arabic and diacritics, plus the intended decomposition/pronunciation reading gesture, against that evidence.
4. Confirm the interaction remains Arabic reading acquisition only and respects VOIR → DÉCOMPOSER → PRONONCER → FLUIDIFIER, precision before fluency, and no grammar/vocabulary/Tajwīd drift.
5. Record one of: `VERIFIED BY QUALIFIED HUMAN`, `CORRECTION REQUIRED`, or `BLOCKED BY AMBIGUOUS SOURCE`, with a traceable note/issue/evidence reference.
6. Any correction must go through the controlled-content workflow and all repository guards; never edit an Arabic string merely to make this checklist pass.

Automated validation, hashes, double visual passes, CI, and model inspection are useful supporting evidence but do not satisfy this human gate by themselves.

## Active-session review matrix

| Category | Active session | Blueprint | Verified manifest | Human status | Evidence / correction reference |
| --- | --- | --- | --- | --- | --- |
| `reading_units` | `UNITS-B01-S01` | `public/content/blueprints/units-batch01.json` | `public/content/verified/s110-batch01.json` | `PENDING QUALIFIED HUMAN REVIEW` | `PENDING` |
| `reading_units` | `UNITS-B01-S02` | `public/content/blueprints/units-batch01.json` | `public/content/verified/s110-batch01.json` | `PENDING QUALIFIED HUMAN REVIEW` | `PENDING` |
| `reading_units` | `UNITS-B01-S03` | `public/content/blueprints/units-batch01.json` | `public/content/verified/s110-batch01.json` | `PENDING QUALIFIED HUMAN REVIEW` | `PENDING` |
| `vowels_sukun` | `VOWELS_SUKUN-B02-S01` | `public/content/blueprints/vowels_sukun-batch02.json` | `public/content/verified/s110-batch02.json` | `PENDING QUALIFIED HUMAN REVIEW` | `PENDING` |
| `vowels_sukun` | `VOWELS_SUKUN-B02-S02` | `public/content/blueprints/vowels_sukun-batch02.json` | `public/content/verified/s110-batch02.json` | `PENDING QUALIFIED HUMAN REVIEW` | `PENDING` |
| `vowels_sukun` | `VOWELS_SUKUN-B02-S03` | `public/content/blueprints/vowels_sukun-batch02.json` | `public/content/verified/s110-batch02.json` | `PENDING QUALIFIED HUMAN REVIEW` | `PENDING` |
| `shaddah` | `SHADDAH-B02-S01` | `public/content/blueprints/shaddah-batch02.json` | `public/content/verified/s110-batch02.json` | `PENDING QUALIFIED HUMAN REVIEW` | `PENDING` |
| `shaddah` | `SHADDAH-B02-S02` | `public/content/blueprints/shaddah-batch02.json` | `public/content/verified/s110-batch02.json` | `PENDING QUALIFIED HUMAN REVIEW` | `PENDING` |
| `shaddah` | `SHADDAH-B02-S03` | `public/content/blueprints/shaddah-batch02.json` | `public/content/verified/s110-batch02.json` | `PENDING QUALIFIED HUMAN REVIEW` | `PENDING` |
| `article_al` | `ARTICLE_AL-B02-S01` | `public/content/blueprints/article_al-batch02.json` | `public/content/verified/s110-batch02.json` | `PENDING QUALIFIED HUMAN REVIEW` | `PENDING` |
| `article_al` | `ARTICLE_AL-B02-S02` | `public/content/blueprints/article_al-batch02.json` | `public/content/verified/s110-batch02.json` | `PENDING QUALIFIED HUMAN REVIEW` | `PENDING` |
| `article_al` | `ARTICLE_AL-B02-S03` | `public/content/blueprints/article_al-batch02.json` | `public/content/verified/s110-batch02.json` | `PENDING QUALIFIED HUMAN REVIEW` | `PENDING` |
| `article_al` | `ARTICLE_AL-B02-S04` | `public/content/blueprints/article_al-batch02.json` | `public/content/verified/s110-batch02.json` | `PENDING QUALIFIED HUMAN REVIEW` | `PENDING` |
| `article_al` | `ARTICLE_AL-B02-S05` | `public/content/blueprints/article_al-batch02.json` | `public/content/verified/s110-batch02.json` | `PENDING QUALIFIED HUMAN REVIEW` | `PENDING` |
| `article_al` | `ARTICLE_AL-B02-S06` | `public/content/blueprints/article_al-batch02.json` | `public/content/verified/s110-batch02.json` | `PENDING QUALIFIED HUMAN REVIEW` | `PENDING` |
| `linking` | `LINKING-B02-S01` | `public/content/blueprints/linking-batch02.json` | `public/content/verified/s110-batch02.json` | `PENDING QUALIFIED HUMAN REVIEW` | `PENDING` |
| `linking` | `LINKING-B02-S02` | `public/content/blueprints/linking-batch02.json` | `public/content/verified/s110-batch02.json` | `PENDING QUALIFIED HUMAN REVIEW` | `PENDING` |
| `linking` | `LINKING-B02-S03` | `public/content/blueprints/linking-batch02.json` | `public/content/verified/s110-batch02.json` | `PENDING QUALIFIED HUMAN REVIEW` | `PENDING` |
| `fluent_reading` | `FLUENT_READING-B02-S01` | `public/content/blueprints/fluent_reading-batch02.json` | `public/content/verified/s110-batch02.json` | `PENDING QUALIFIED HUMAN REVIEW` | `PENDING` |
| `fluent_reading` | `FLUENT_READING-B02-S02` | `public/content/blueprints/fluent_reading-batch02.json` | `public/content/verified/s110-batch02.json` | `PENDING QUALIFIED HUMAN REVIEW` | `PENDING` |
| `fluent_reading` | `FLUENT_READING-B02-S03` | `public/content/blueprints/fluent_reading-batch02.json` | `public/content/verified/s110-batch02.json` | `PENDING QUALIFIED HUMAN REVIEW` | `PENDING` |

The session set above must stay identical to `public/content/activation/active-sessions.json`. If activation changes, update this matrix before using it as V1 evidence.

## Completion rule

#152 can be considered complete only when reviewer metadata is traceable, every active row has a qualified-human outcome, every correction/blocker is resolved or explicitly blocks release, and the controlled-content validations and CI remain green after any resulting content change.
