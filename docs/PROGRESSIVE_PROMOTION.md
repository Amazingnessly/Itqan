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

## Automated safety test

```bash
npm run test:progressive-promotion-gate
```

The test verifies deterministic output, exact non-normalized byte preservation, evidence hashing, path confinement, ambiguity rejection, dual-pass enforcement, and inactive-by-default promotion.
