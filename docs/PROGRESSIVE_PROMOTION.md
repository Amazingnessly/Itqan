# Progressive human-verification promotion gate

This document describes the controlled handoff from the qualified human verification UI to an inactive controlled-manifest candidate.

## Safety boundary

A provisional transcription candidate is never authoritative. The UI reviews a large module in source-ordered subsets of at most 20 candidates so the qualified human does not have to validate hundreds of items in one export. Promotion starts only from a module-scoped source-subset human-verification artifact exported after:

- the canonical PDF has matched the registered SHA-256;
- visual pass 1 is complete for every item;
- visual pass 2 is complete for every item;
- ambiguity has been explicitly reviewed and is false for every item;
- the exact UTF-8 bytes and their SHA-256 hashes have been preserved without normalization.

The verification artifact is validated with:

```bash
npm run validate:progressive-human-verification -- --verification <verification.json>
```

This command does not activate content.

## Audit several verified subsets before evidence work

Before creating full-page/crop evidence for several human-verified lots from the same module, audit their combined source coverage:

```bash
npm run audit:progressive-verification-coverage -- \\
  --verification <module-part-01.json> \\
  --verification <module-part-02.json>
```

This pre-evidence audit reuses the full human-verification validator for every input and then checks the union. It fails closed on source/module/category drift, invalid exact UTF-8 hashes, missing human checks, ambiguous items, unregistered source positions, duplicate positions inside a subset, or overlap between subsets.

The JSON result reports:

- the registered candidate count for the module;
- verified source positions in deterministic page/order order;
- source positions still missing;
- the original subset/part metadata for provenance;
- `registeredCandidateCoverageComplete`, which means only that every currently registered provisional candidate position is represented by the supplied human-verification artifacts.

Use `--require-complete` only when complete registered-candidate coverage is actually required. Incomplete coverage is otherwise a valid intermediate state and must not be described as full-module verification.

This audit does not create repository evidence, promote content, annotate item-level features, or activate lessons.

## Prepare repository evidence without manual JSON or hashes

After the verified-subset coverage audit is clean, generate a deterministic worklist of the repository files that still need to be produced:

```bash
npm run plan:progressive-evidence -- \\
  --verification <module-part-01.json> \\
  --verification <module-part-02.json>
```

The worklist contains no Arabic transcription. It assigns deterministic repository paths under `public/content/evidence/progressive/<module>/`:

- one reusable full-page PNG per referenced PDF page;
- one item crop PNG per exact `page:sourceOrder` position.

Generating the worklist does **not** create those images and does not claim that evidence exists. The visual evidence must still be prepared from the canonical source and checked as required.

Once the files listed by the worklist are actually present in the repository, build the evidence map for one verified subset:

```bash
npm run build:progressive-evidence-map -- \\
  --verification <module-part-01.json> \\
  --out public/content/evidence/progressive/<module>/part-01-evidence-map.json
```

This command fails closed if a required full-page or crop file is missing or outside `public/content/evidence/`. It computes the SHA-256 values directly from the repository bytes and binds the evidence-map subset metadata back to the verification artifact. The existing promotion gate re-validates those files and hashes again before promotion.

These commands automate file naming, coverage bookkeeping and hashing only. They do not decide whether a crop is visually correct, do not promote provisional text, and do not activate content.

## Repository evidence requirement

A verification artifact is still insufficient for promotion. Partial review is allowed, but every source position present in that exported subset must belong to the registered provisional candidate bundle and must be bound to two repository-backed evidence files:

1. a full-page view;
2. a crop/zoom view for the exact item.

The evidence map uses this shape:

```json
{
  "schemaVersion": "0.1",
  "kind": "itqan-progressive-repository-evidence-map",
  "sourceDocumentId": "SOURCE-ID",
  "sourceDocumentSha256": "SOURCE-SHA256",
  "moduleId": "module_id",
  "items": [
    {
      "sourcePdfPage": 1,
      "sourceOrder": 1,
      "evidence": {
        "full": "public/content/evidence/progressive/example/full.png",
        "crop": "public/content/evidence/progressive/example/crop.png"
      },
      "integrity": {
        "fullSha256": "FULL-FILE-SHA256",
        "cropSha256": "CROP-FILE-SHA256"
      }
    }
  ]
}
```

Evidence paths outside `public/content/evidence/`, missing files, path traversal, hash mismatches, incomplete coverage of the exported subset, duplicate source positions, unregistered candidate positions, or a source/module mismatch fail closed. A subset never claims that the rest of the module was verified.

## Promotion

Once both the human-verification artifact and repository evidence map pass, the deterministic promotion command is:

```bash
npm run promote:progressive-human-verification -- \
  --verification <verification.json> \
  --evidence <evidence-map.json> \
  --out public/content/source-intake/promoted/<module>.json
```

The output is deliberately **not** an active lesson manifest. It is an `itqan-progressive-controlled-manifest-candidate` with:

- exact human-approved bytes;
- the exact human-approved UTF-8 hash;
- two human visual passes;
- bound full-page and crop evidence plus their repository-byte hashes;
- `eligibleForActiveLesson: false`;
- `active: false`;
- unresolved item-level feature metadata.

The output path is restricted to `public/content/source-intake/promoted/` until a later controlled-manifest review explicitly resolves item-level feature metadata and the session policy is rebuilt.

## Aggregating several promoted subsets from one module

Each reviewed subset should first be promoted to its own file. Do not reuse one output filename for successive lots.

Once two or more promoted subset files exist for the same module, build the module-level inactive candidate with:

```bash
npm run aggregate:progressive-promoted-candidates -- \
  --input public/content/source-intake/promoted/<module>-part-01.json \
  --input public/content/source-intake/promoted/<module>-part-02.json \
  --out public/content/source-intake/promoted/<module>.json
```

Aggregation fails closed unless every input:

- is still an inactive `itqan-progressive-controlled-manifest-candidate`;
- points to the same canonical source and the same registered module/category;
- preserves the deterministic source-position item id;
- preserves the exact UTF-8 hash without normalization;
- still has two human visual passes and `ambiguous: false`;
- still points to repository-backed full-page and crop evidence whose hashes match the current repository bytes;
- uses only source positions registered in that module's provisional candidate bundle.

The union rejects duplicate source positions and duplicate item ids. Items are deterministically sorted by PDF page and source order. The aggregate records the exact source positions plus the repository-relative filename and SHA-256 of every input subset manifest.

`verificationScope.registeredCandidateCoverageComplete` is narrowly defined: it becomes true only when the union covers every source position in the currently registered provisional candidate bundle. It does **not** mean the module is active, item-level feature annotation is complete, controlled-manifest review is complete, or the learner session policy is rebuilt. The aggregate keeps all three activation blockers and all items remain `eligibleForActiveLesson: false` and `active: false`.

## Qualified-human item-level feature annotation

Promotion deliberately stops at `pending_item_level_feature_annotation`. The next step is a separate qualified-human metadata review; an agent must not infer these linguistic features from `arabicExact`.

The controlled vocabulary and module stage-purity rules live in one shared contract: `public/content/source-intake/feature-annotation-policy.json`. Both the repository gate and the reviewer UI consume that same file. Every annotation artifact records the policy schema version and the SHA-256 of its exact bytes; if the policy changes, an older draft or completed artifact fails closed until it is reviewed again against the current policy.


Prepare a blank annotation artifact from one promoted candidate:

```bash
npm run prepare:progressive-feature-annotation -- \\
  --candidate public/content/source-intake/promoted/<module>.json \\
  --out public/content/source-intake/annotations/<module>.json
```

The template binds every item to its deterministic item id, source page/order, exact Arabic UTF-8 hash, the SHA-256 of the promoted candidate manifest, and the SHA-256 of the shared feature-annotation policy. Linguistic values are intentionally not prefilled.

For every item, the qualified human must explicitly complete:

- `focusMarksObserved`, using only the controlled vocabulary: `fathah`, `kasrah`, `dammah`, `tanwin`, `sukun`, `shaddah`;
- `articleClassObserved`: `qamariyyah`, `shamsiyyah`, or an empty array when no article class is observed;
- `materialShapeObserved`: `isolated_word`, `two_words`, or `multi_word`;
- `hamzatWaslCandidate`: explicit boolean;
- `featureInventoryComplete: true`;
- `targetFeatureConfirmed: true`;
- `stagePurityConfirmed: true`;
- `reviewedByQualifiedHuman: true`;
- `ambiguous: false`.

The artifact itself must be changed to `status: "qualified_human_feature_annotation_complete"` only after that review.

For qualified reviewers who should not edit JSON manually, the application also exposes **Sources → Annoter les items promus**. That local surface:

- imports the promoted candidate file explicitly;
- revalidates its exact SHA-256, item hashes and registered source positions;
- fetches the deployed full-page/crop evidence and re-hashes those bytes before annotation starts;
- initializes every linguistic field blank or unreviewed;
- displays one item and its evidence at a time;
- allows an explicit draft export/re-import without `localStorage` or server-side authoring;
- enables the completed export only after all explicit review fields and the known module stage-purity constraints pass locally.

The UI is a reviewer aid, not the final authority of the pipeline. Its completed artifact must still pass the repository CLI gate below.

Apply the completed annotation with:

```bash
npm run apply:progressive-feature-annotation -- \\
  --candidate public/content/source-intake/promoted/<module>.json \\
  --annotation public/content/source-intake/annotations/<module>.json \\
  --out public/content/source-intake/annotated/<module>.json
```

The gate revalidates repository-backed evidence, exact candidate bytes, item ids, source positions, exact Arabic hashes, controlled metadata vocabulary, qualified-human completion and known stage-purity constraints. For example, Sukūn material must remain isolated-word, must explicitly record Sukūn, and must reject Shaddah/article leakage; the page-57 shamsiyyah wave must be shamsiyyah-only and record Shaddah.

Successful application resolves only `item_level_feature_metadata_required`. The output remains `eligibleForActiveLesson: false` and `active: false`, with both `controlled_manifest_review_required` and `session_policy_rebuild_required` still blocking activation.

## Controlled-manifest review before session rebuild

A completed item-level feature annotation still does not make the progressive items active. The next explicit gate is a separate controlled-manifest review over the exact promoted candidate, exact human annotation, and exact annotated candidate bytes.

Prepare the review artifact with:

```bash
npm run prepare:progressive-controlled-manifest-review -- \\
  --annotated public/content/source-intake/annotated/<module>.json \\
  --candidate public/content/source-intake/promoted/<module>.json \\
  --annotation public/content/source-intake/annotations/<module>.json \\
  --out public/content/source-intake/reviews/<module>.json
```

The pending review artifact deliberately does not copy `arabicExact`. For each item it binds:

- deterministic item id and source page/order;
- the exact Arabic UTF-8 hash;
- a hash of the controlled item metadata;
- SHA-256 identities for the promoted, annotation, and annotated input artifacts;
- the currently approved feature-annotation policy hash.

A qualified content reviewer must explicitly confirm, for every item:

- exact bytes/hash reviewed;
- repository evidence binding reviewed;
- feature metadata reviewed;
- target exercise authorization reviewed;
- stage purity reviewed;
- decision = `approve`;
- `reviewedByQualifiedContentReviewer: true`.

A review marked `qualified_content_review_complete` fails closed if any item is missing, rejected, unchecked, duplicated, or has drifted source/hash/metadata. Silent item exclusion is forbidden.

For a reviewer who should not edit review JSON manually, the application also exposes **Sources → Revoir le manifest contrôlé**. The local review surface requires the exact three upstream artifacts (`promoted`, completed feature annotation, and `annotated`) in one import. Before a decision can be recorded it:

- hashes all three artifacts and verifies their cross-links;
- reloads the current source registry and feature-annotation policy;
- binds every item to a registered source position;
- re-hashes `arabicExact` without normalization;
- fetches the deployed full-page/crop evidence and verifies their repository hashes;
- compares the annotated metadata back to the completed qualified-human annotation and current module policy;
- presents the already-controlled Arabic, evidence, and metadata read-only.

The reviewer can then explicitly approve or reject each item and record the five review checks. Rejections remain valid only in a draft and block a completed export. Draft export/re-import is explicit; the UI uses neither `localStorage` nor server-side authoring. A completed UI artifact must still pass the repository CLI gate below.

Apply the completed review with:

```bash
npm run apply:progressive-controlled-manifest-review -- \\
  --annotated public/content/source-intake/annotated/<module>.json \\
  --candidate public/content/source-intake/promoted/<module>.json \\
  --annotation public/content/source-intake/annotations/<module>.json \\
  --review public/content/source-intake/reviews/<module>.json \\
  --out public/content/source-intake/reviewed/<module>.json
```

Successful review resolves only `controlled_manifest_review_required`. The output status becomes `controlled_manifest_reviewed_pending_session_policy_rebuild`, but every item remains `eligibleForActiveLesson: false` and `active: false`. The sole remaining activation blocker is `session_policy_rebuild_required`; this command does not edit blueprints, the activation allowlist, or runtime fingerprints.

## Audit current repository pipeline state

At any point, inspect the deepest validated repository-backed stage for every candidate-backed module with:

```bash
npm run audit:progressive-pipeline
```

The audit is progress-aware: incomplete human work is not an error. A module may validly report states such as `candidate_ready_for_human_verification`, `promoted_pending_feature_annotation`, `annotated_pending_controlled_manifest_review`, or `reviewed_pending_session_policy_rebuild`. Each module also exposes `nextRequiredArtifact`.

The command **does** fail closed when repository state is internally inconsistent: a downstream artifact without its upstream input, changed source/policy hashes, invalid evidence, annotation drift, controlled-review drift, missing items, or a reviewed candidate that no longer reproduces deterministically from its exact upstream artifacts. This makes the audit suitable for CI while still allowing the qualified-human workflow to progress incrementally.

## Automated safety test

```bash
npm run test:progressive-promotion-gate
```

The test verifies deterministic output, exact non-normalized byte preservation, evidence hashing, path confinement, ambiguity rejection, dual-pass enforcement, and inactive-by-default promotion.
