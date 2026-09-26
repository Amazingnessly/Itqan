import assert from "node:assert/strict";
import {
  VERIFICATION_KIND,
  auditHumanVerificationCoverage,
  readJson,
  sha256TextExact,
} from "./progressive-verification-lib.mjs";

const registry = readJson("public/content/source-intake/progressive-support.json");

function moduleFixture(moduleId, start, end, partIndex, partCount) {
  const module = registry.modules.find((entry) => entry.id === moduleId);
  assert.ok(module?.candidateBundle, `${moduleId} must expose a registered candidate bundle.`);
  const candidateBundle = readJson("public" + module.candidateBundle);
  const selected = candidateBundle.items.slice(start, end);
  assert.ok(selected.length > 0, `${moduleId} fixture must select at least one registered candidate.`);

  const items = selected.map((candidate) => {
    const exact = `verified-${moduleId}-${candidate.sourcePdfPage}-${candidate.sourceOrder}`;
    return {
      moduleId,
      sourcePdfPage: candidate.sourcePdfPage,
      sourceOrder: candidate.sourceOrder,
      arabicExact: exact,
      candidateOrigin: "provisional_machine",
      integrity: {
        utf8Sha256: sha256TextExact(exact),
        normalizationApplied: false,
        differsFromNfc: exact.normalize("NFC") !== exact,
      },
      verification: {
        visualPass1: true,
        visualPass2: true,
        ambiguous: false,
        reviewedAmbiguity: true,
        humanVerified: true,
      },
      notes: "",
    };
  });

  return {
    schemaVersion: "0.2",
    kind: VERIFICATION_KIND,
    sourceRegistrySchemaVersion: registry.schemaVersion,
    sourceRegistryStatus: registry.status,
    verificationScope: {
      moduleId,
      targetCategory: module.targetCategory,
      coverage: "source_subset",
      candidateCountInModule: module.candidateCount,
      itemCount: items.length,
      partIndex,
      partCount,
      sourcePositions: items.map((item) => ({
        sourcePdfPage: item.sourcePdfPage,
        sourceOrder: item.sourceOrder,
      })),
    },
    sourceDocument: {
      id: registry.sourceDocument.id,
      filename: registry.sourceDocument.uploadedFilename,
      byteLength: 123,
      sha256: registry.sourceDocument.sha256,
    },
    humanVerificationAuthority: true,
    candidateTranscriptionAuthoritative: false,
    normalizationApplied: false,
    items,
  };
}

const sukun = registry.modules.find((entry) => entry.id === "sukun");
assert.ok(sukun?.candidateCount === 23, "Coverage fixture assumes the registered 23-item Sukun wave.");

const first = moduleFixture("sukun", 0, 10, 1, 3);
const second = moduleFixture("sukun", 10, 20, 2, 3);
const third = moduleFixture("sukun", 20, 23, 3, 3);

const partial = auditHumanVerificationCoverage([second, first], registry);
assert.equal(partial.moduleId, "sukun");
assert.equal(partial.subsetCount, 2);
assert.equal(partial.registeredCandidateCount, 23);
assert.equal(partial.verifiedItemCount, 20);
assert.equal(partial.registeredCandidateCoverageComplete, false);
assert.equal(partial.missingSourcePositions.length, 3);
assert.deepEqual(
  partial.verifiedSourcePositions,
  [...partial.verifiedSourcePositions].sort(
    (left, right) =>
      left.sourcePdfPage - right.sourcePdfPage ||
      left.sourceOrder - right.sourceOrder,
  ),
  "Coverage audit must report verified positions in deterministic source order.",
);

const complete = auditHumanVerificationCoverage([third, first, second], registry);
assert.equal(complete.verifiedItemCount, 23);
assert.equal(complete.missingSourcePositions.length, 0);
assert.equal(complete.registeredCandidateCoverageComplete, true);
assert.equal(complete.subsets.length, 3);
assert.deepEqual(
  complete.subsets.map((subset) => subset.partIndex),
  [3, 1, 2],
  "Coverage audit must preserve per-input subset provenance rather than re-label parts.",
);

const overlapping = moduleFixture("sukun", 9, 12, 2, 3);
assert.throws(
  () => auditHumanVerificationCoverage([first, overlapping], registry),
  /overlap at source position/,
  "Overlapping human-verification subsets must fail before evidence work.",
);

const otherModule = moduleFixture("tanwin_kasr", 0, 2, 1, 1);
assert.throws(
  () => auditHumanVerificationCoverage([first, otherModule], registry),
  /same module/,
  "Coverage audit must not combine verification subsets from different modules.",
);

const tampered = structuredClone(first);
tampered.items[0].integrity.utf8Sha256 = "0".repeat(64);
assert.throws(
  () => auditHumanVerificationCoverage([tampered], registry),
  /UTF-8 hash/,
  "Coverage audit must reuse the full human-verification integrity gate.",
);

console.log("Progressive human-verification multi-subset coverage audit passed.");
