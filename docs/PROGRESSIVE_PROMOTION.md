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

## Automated safety test

```bash
npm run test:progressive-promotion-gate
```

The test verifies deterministic output, exact non-normalized byte preservation, evidence hashing, path confinement, ambiguity rejection, dual-pass enforcement, and inactive-by-default promotion.
