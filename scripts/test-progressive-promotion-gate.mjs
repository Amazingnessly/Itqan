import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  EVIDENCE_KIND,
  PROMOTED_KIND,
  aggregatePromotedCandidates,
  VERIFICATION_KIND,
  promoteVerification,
  readJson,
  sha256Bytes,
  sha256TextExact,
  validateHumanVerificationBundle,
  validateRepositoryEvidenceMap,
} from "./progressive-verification-lib.mjs";

const registry = readJson("public/content/source-intake/progressive-support.json");
const module = registry.modules.find((entry) => entry.id === "sukun");
assert.ok(module, "Sukun module must exist in the production registry.");
assert.ok(Number.isInteger(module.candidateCount) && module.candidateCount > 0, "Sukun module must expose a registered provisional candidate count.");
const sourceCandidates = readJson("public" + module.candidateBundle);
assert.equal(sourceCandidates.items.length, module.candidateCount, "Promotion fixture must follow the registered Sukun source positions.");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "itqan-progressive-promotion-"));
const evidenceDir = path.join(tempRoot, "public/content/evidence/promotion-test");
fs.mkdirSync(evidenceDir, { recursive: true });

try {
  const selectedSourceCandidates = sourceCandidates.items.slice(0, 3);
  const items = selectedSourceCandidates.map((sourceItem, index) => {
    const exact = index === 0 ? "e\u0301-sample-1" : `sample-${index + 1}`;
    return {
      moduleId: module.id,
      sourcePdfPage: sourceItem.sourcePdfPage,
      sourceOrder: sourceItem.sourceOrder,
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

  const verification = {
    schemaVersion: "0.2",
    kind: VERIFICATION_KIND,
    sourceRegistrySchemaVersion: registry.schemaVersion,
    sourceRegistryStatus: registry.status,
    verificationScope: {
      moduleId: module.id,
      targetCategory: module.targetCategory,
      coverage: "source_subset",
      candidateCountInModule: module.candidateCount,
      itemCount: items.length,
      partIndex: 1,
      partCount: Math.ceil(module.candidateCount / 20),
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

  const evidenceItems = items.map((item, index) => {
    const fullRelative = `public/content/evidence/promotion-test/full-${index + 1}.bin`;
    const cropRelative = `public/content/evidence/promotion-test/crop-${index + 1}.bin`;
    const fullBytes = Buffer.from(`full-page-${index + 1}`, "utf8");
    const cropBytes = Buffer.from(`crop-${index + 1}`, "utf8");
    fs.writeFileSync(path.join(tempRoot, fullRelative), fullBytes);
    fs.writeFileSync(path.join(tempRoot, cropRelative), cropBytes);
    return {
      sourcePdfPage: item.sourcePdfPage,
      sourceOrder: item.sourceOrder,
      evidence: {
        full: fullRelative,
        crop: cropRelative,
      },
      integrity: {
        fullSha256: sha256Bytes(fullBytes),
        cropSha256: sha256Bytes(cropBytes),
      },
    };
  });

  const evidenceMap = {
    schemaVersion: "0.1",
    kind: EVIDENCE_KIND,
    sourceDocumentId: registry.sourceDocument.id,
    sourceDocumentSha256: registry.sourceDocument.sha256,
    moduleId: module.id,
    items: evidenceItems,
  };

  const validated = validateHumanVerificationBundle(verification, registry);
  assert.equal(validated.items.length, selectedSourceCandidates.length);
  assert.equal(validated.items[0].arabicExact, "e\u0301-sample-1", "Exact non-NFC bytes must be preserved rather than normalized.");

  const validatedEvidence = validateRepositoryEvidenceMap(evidenceMap, verification, registry, tempRoot);
  assert.equal(validatedEvidence.length, selectedSourceCandidates.length);

  const firstPromotion = promoteVerification({ verification, evidenceMap, registry, repoRoot: tempRoot });
  const secondPromotion = promoteVerification({ verification, evidenceMap, registry, repoRoot: tempRoot });
  assert.deepEqual(firstPromotion, secondPromotion, "Promotion must be deterministic for the same verified bytes and evidence.");
  assert.equal(firstPromotion.kind, PROMOTED_KIND);
  assert.equal(firstPromotion.status, "human_verified_repository_evidence_bound_pending_item_metadata");
  assert.equal(firstPromotion.items.length, selectedSourceCandidates.length);
  assert.ok(firstPromotion.items.every((item) => item.eligibleForActiveLesson === false && item.active === false), "Promotion must never activate items.");
  assert.ok(firstPromotion.items.every((item) => item.metadataStatus === "pending_item_level_feature_annotation"), "Promotion must keep item-level feature annotation unresolved.");
  assert.equal(firstPromotion.items[0].arabicExact, verification.items[0].arabicExact, "Promotion must preserve exact human-approved bytes.");
  assert.equal(firstPromotion.items[0].integrity.utf8Sha256, verification.items[0].integrity.utf8Sha256, "Promotion must preserve the human-approved exact hash.");

  const secondSelectedSourceCandidates = sourceCandidates.items.slice(3, 6);
  const secondItems = secondSelectedSourceCandidates.map((sourceItem, index) => {
    const exact = `second-sample-${index + 1}`;
    return {
      moduleId: module.id,
      sourcePdfPage: sourceItem.sourcePdfPage,
      sourceOrder: sourceItem.sourceOrder,
      arabicExact: exact,
      candidateOrigin: "provisional_machine",
      integrity: {
        utf8Sha256: sha256TextExact(exact),
        normalizationApplied: false,
        differsFromNfc: false,
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
  const secondVerification = structuredClone(verification);
  secondVerification.items = secondItems;
  secondVerification.verificationScope.itemCount = secondItems.length;
  secondVerification.verificationScope.partIndex = 2;
  secondVerification.verificationScope.sourcePositions = secondItems.map((item) => ({
    sourcePdfPage: item.sourcePdfPage,
    sourceOrder: item.sourceOrder,
  }));

  const secondEvidenceItems = secondItems.map((item, index) => {
    const evidenceIndex = index + 4;
    const fullRelative = `public/content/evidence/promotion-test/full-${evidenceIndex}.bin`;
    const cropRelative = `public/content/evidence/promotion-test/crop-${evidenceIndex}.bin`;
    const fullBytes = Buffer.from(`full-page-${evidenceIndex}`, "utf8");
    const cropBytes = Buffer.from(`crop-${evidenceIndex}`, "utf8");
    fs.writeFileSync(path.join(tempRoot, fullRelative), fullBytes);
    fs.writeFileSync(path.join(tempRoot, cropRelative), cropBytes);
    return {
      sourcePdfPage: item.sourcePdfPage,
      sourceOrder: item.sourceOrder,
      evidence: {
        full: fullRelative,
        crop: cropRelative,
      },
      integrity: {
        fullSha256: sha256Bytes(fullBytes),
        cropSha256: sha256Bytes(cropBytes),
      },
    };
  });
  const secondEvidenceMap = {
    ...evidenceMap,
    items: secondEvidenceItems,
  };
  const secondPromotion = promoteVerification({
    verification: secondVerification,
    evidenceMap: secondEvidenceMap,
    registry,
    repoRoot: tempRoot,
  });

  const aggregationOptions = {
    evidenceRepoRoot: tempRoot,
    candidateRepoRoot: process.cwd(),
    inputManifests: [
      { file: "public/content/source-intake/promoted/sukun-part-01.json", sha256: "a".repeat(64) },
      { file: "public/content/source-intake/promoted/sukun-part-02.json", sha256: "b".repeat(64) },
    ],
  };
  const aggregated = aggregatePromotedCandidates(
    [secondPromotion, firstPromotion],
    registry,
    aggregationOptions,
  );
  assert.equal(aggregated.kind, PROMOTED_KIND);
  assert.equal(aggregated.verificationScope.coverage, "aggregated_source_subsets");
  assert.equal(aggregated.verificationScope.sourceSubsetCount, 2);
  assert.equal(aggregated.verificationScope.promotedItemCount, 6);
  assert.equal(
    aggregated.verificationScope.registeredCandidateCoverageComplete,
    false,
    "A partial aggregation must not claim full registered-candidate coverage.",
  );
  assert.equal(aggregated.aggregation.inputManifests.length, 2, "Aggregation must preserve input-manifest provenance.");
  assert.ok(
    aggregated.items.every((item) => item.eligibleForActiveLesson === false && item.active === false),
    "Aggregated promoted items must remain inactive.",
  );

  const expectedSortedIds = [...firstPromotion.items, ...secondPromotion.items]
    .sort((left, right) =>
      left.source.pdfPage - right.source.pdfPage ||
      left.source.sourceOrder - right.source.sourceOrder ||
      left.id.localeCompare(right.id),
    )
    .map((item) => item.id);
  assert.deepEqual(
    aggregated.items.map((item) => item.id),
    expectedSortedIds,
    "Aggregated items must be deterministically source ordered.",
  );

  assert.throws(
    () =>
      aggregatePromotedCandidates([firstPromotion, firstPromotion], registry, {
        evidenceRepoRoot: tempRoot,
        candidateRepoRoot: process.cwd(),
      }),
    /overlap at source position/,
    "Overlapping promoted subsets must fail closed.",
  );

  const tamperedHash = structuredClone(verification);
  tamperedHash.items[0].integrity.utf8Sha256 = "0".repeat(64);
  assert.throws(() => validateHumanVerificationBundle(tamperedHash, registry), /UTF-8 hash/);

  const missingPass = structuredClone(verification);
  missingPass.items[1].verification.visualPass2 = false;
  assert.throws(() => validateHumanVerificationBundle(missingPass, registry), /visual pass 2/);

  const ambiguous = structuredClone(verification);
  ambiguous.items[2].verification.ambiguous = true;
  assert.throws(() => validateHumanVerificationBundle(ambiguous, registry), /remains ambiguous/);

  const unregisteredPosition = structuredClone(verification);
  unregisteredPosition.items[0].sourceOrder = 9999;
  unregisteredPosition.verificationScope.sourcePositions[0].sourceOrder = 9999;
  assert.throws(() => validateHumanVerificationBundle(unregisteredPosition, registry), /not present in the registered candidate bundle/);

  const badScopePositions = structuredClone(verification);
  badScopePositions.verificationScope.sourcePositions[0].sourceOrder = 9999;
  assert.throws(() => validateHumanVerificationBundle(badScopePositions, registry), /source positions do not match/);

  const badEvidenceHash = structuredClone(evidenceMap);
  badEvidenceHash.items[0].integrity.cropSha256 = "f".repeat(64);
  assert.throws(() => validateRepositoryEvidenceMap(badEvidenceHash, verification, registry, tempRoot), /crop SHA-256/);

  const escapedEvidence = structuredClone(evidenceMap);
  escapedEvidence.items[0].evidence.full = "../outside.bin";
  assert.throws(() => validateRepositoryEvidenceMap(escapedEvidence, verification, registry, tempRoot), /public\/content\/evidence/);

  console.log("Progressive human-verification promotion gate passed.");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
