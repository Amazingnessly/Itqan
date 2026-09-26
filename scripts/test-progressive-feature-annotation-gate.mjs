import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ANNOTATED_CANDIDATE_STATUS,
  FEATURE_ANNOTATION_KIND,
  PROMOTED_KIND,
  applyFeatureAnnotation,
  buildFeatureAnnotationTemplate,
  readJson,
  sha256Bytes,
  sha256TextExact,
  validateAnnotatedCandidate,
  validateFeatureAnnotation,
} from "./progressive-verification-lib.mjs";

const registry = readJson("public/content/source-intake/progressive-support.json");
const module = registry.modules.find((entry) => entry.id === "sukun");
assert.ok(module?.candidateBundle, "Sukun module must expose a registered candidate bundle.");
const sourceCandidates = readJson("public" + module.candidateBundle);
const sourcePosition = sourceCandidates.items[0];
assert.ok(sourcePosition, "Sukun fixture requires one registered source position.");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "itqan-feature-annotation-"));
const evidenceDir = path.join(tempRoot, "public/content/evidence/annotation-test");
fs.mkdirSync(evidenceDir, { recursive: true });

try {
  const fullRelative = "public/content/evidence/annotation-test/p048-full.bin";
  const cropRelative = "public/content/evidence/annotation-test/p048-o001-crop.bin";
  const fullBytes = Buffer.from("full-page-proof", "utf8");
  const cropBytes = Buffer.from("crop-proof", "utf8");
  fs.writeFileSync(path.join(tempRoot, fullRelative), fullBytes);
  fs.writeFileSync(path.join(tempRoot, cropRelative), cropBytes);

  const exact = "synthetic-exact-bytes";
  const candidate = {
    schemaVersion: "0.1",
    kind: PROMOTED_KIND,
    project: "Itqān",
    status: "human_verified_repository_evidence_bound_pending_item_metadata",
    sourceControl: {
      canonicalSourceId: registry.sourceDocument.id,
      canonicalFile: registry.sourceDocument.uploadedFilename,
      canonicalSha256: registry.sourceDocument.sha256,
      visualPassesPerItem: 2,
      silentNormalization: false,
      modelOrOcrUsedAsAuthority: false,
    },
    verificationScope: {
      moduleId: module.id,
      targetCategory: module.targetCategory,
    },
    activationPolicy: {
      eligibleForActiveLesson: false,
      active: false,
      blockers: [
        "item_level_feature_metadata_required",
        "controlled_manifest_review_required",
        "session_policy_rebuild_required",
      ],
    },
    items: [
      {
        id: "ITQAN-PROG-SUKUN-P048-001",
        source: {
          sourceId: registry.sourceDocument.id,
          file: registry.sourceDocument.uploadedFilename,
          pdfPage: sourcePosition.sourcePdfPage,
          sourceOrder: sourcePosition.sourceOrder,
        },
        arabicExact: exact,
        integrity: {
          utf8Sha256: sha256TextExact(exact),
          normalizationApplied: false,
        },
        verification: {
          visualPass1: true,
          visualPass1Method: "qualified_human_against_canonical_pdf",
          visualPass2: true,
          visualPass2Method: "qualified_human_second_pass_against_canonical_pdf",
          evidence: {
            full: fullRelative,
            crop: cropRelative,
          },
          evidenceIntegrity: {
            fullSha256: sha256Bytes(fullBytes),
            cropSha256: sha256Bytes(cropBytes),
          },
          ambiguous: false,
        },
        candidateOrigin: "provisional_machine",
        allowedExerciseTypes: [module.targetCategory],
        metadataStatus: "pending_item_level_feature_annotation",
        eligibleForActiveLesson: false,
        active: false,
      },
    ],
  };

  const candidateBytes = Buffer.from(JSON.stringify(candidate, null, 2) + "\n", "utf8");
  const candidateSha256 = sha256Bytes(candidateBytes);
  const options = {
    candidateManifestSha256: candidateSha256,
    evidenceRepoRoot: tempRoot,
    candidateRepoRoot: process.cwd(),
  };

  const template = buildFeatureAnnotationTemplate(candidate, registry, options);
  assert.equal(template.kind, FEATURE_ANNOTATION_KIND);
  assert.equal(template.status, "pending_qualified_human_feature_annotation");
  assert.equal(template.items.length, 1);
  assert.equal(template.items[0].arabicUtf8Sha256, candidate.items[0].integrity.utf8Sha256);
  assert.equal(template.items[0].annotation.materialShapeObserved, null);
  assert.equal(template.items[0].annotation.targetFeatureConfirmed, null);
  assert.equal(template.items[0].annotation.reviewedByQualifiedHuman, false);

  const completed = structuredClone(template);
  completed.status = "qualified_human_feature_annotation_complete";
  completed.items[0].annotation = {
    focusMarksObserved: ["sukun"],
    articleClassObserved: [],
    materialShapeObserved: "isolated_word",
    hamzatWaslCandidate: false,
    featureInventoryComplete: true,
    targetFeatureConfirmed: true,
    stagePurityConfirmed: true,
    reviewedByQualifiedHuman: true,
    ambiguous: false,
    notes: "Qualified-human metadata fixture.",
  };

  const validated = validateFeatureAnnotation(completed, candidate, registry, options);
  assert.equal(validated.annotations.length, 1);

  const annotated = applyFeatureAnnotation(candidate, completed, registry, options);
  assert.equal(annotated.status, ANNOTATED_CANDIDATE_STATUS);
  assert.equal(annotated.items[0].metadataStatus, "human_annotated_pending_controlled_manifest_review");
  assert.deepEqual(annotated.items[0].focusMarksObserved, ["sukun"]);
  assert.deepEqual(annotated.items[0].articleClassObserved, []);
  assert.equal(annotated.items[0].materialShapeObserved, "isolated_word");
  assert.equal(annotated.items[0].eligibleForActiveLesson, false);
  assert.equal(annotated.items[0].active, false);
  assert.ok(!annotated.activationPolicy.blockers.includes("item_level_feature_metadata_required"));
  assert.ok(annotated.activationPolicy.blockers.includes("controlled_manifest_review_required"));
  assert.ok(annotated.activationPolicy.blockers.includes("session_policy_rebuild_required"));
  assert.deepEqual(
    validateAnnotatedCandidate(annotated, candidate, completed, registry, options),
    annotated,
  );

  assert.match(template.featureAnnotationPolicy.sha256, /^[a-f0-9]{64}$/, "Annotation template must bind the exact shared policy bytes.");
  assert.equal(template.featureAnnotationPolicy.schemaVersion, "0.1");

  const driftedPolicy = structuredClone(completed);
  driftedPolicy.featureAnnotationPolicy.sha256 = "0".repeat(64);
  assert.throws(
    () => validateFeatureAnnotation(driftedPolicy, candidate, registry, options),
    /policy SHA-256/,
    "Feature annotation must fail if the shared controlled policy bytes drift.",
  );

  const driftedCandidate = structuredClone(completed);
  driftedCandidate.promotedCandidate.sha256 = "0".repeat(64);
  assert.throws(
    () => validateFeatureAnnotation(driftedCandidate, candidate, registry, options),
    /promoted-candidate SHA-256/,
    "Feature annotation must fail if the promoted candidate bytes drift.",
  );

  const missingHuman = structuredClone(completed);
  missingHuman.items[0].annotation.reviewedByQualifiedHuman = false;
  assert.throws(
    () => validateFeatureAnnotation(missingHuman, candidate, registry, options),
    /qualified human/,
    "Feature annotation must require explicit qualified-human review.",
  );

  const ambiguous = structuredClone(completed);
  ambiguous.items[0].annotation.ambiguous = true;
  assert.throws(
    () => validateFeatureAnnotation(ambiguous, candidate, registry, options),
    /remains ambiguous/,
    "Ambiguous item-level metadata must fail closed.",
  );

  const incompleteInventory = structuredClone(completed);
  incompleteInventory.items[0].annotation.featureInventoryComplete = false;
  assert.throws(
    () => validateFeatureAnnotation(incompleteInventory, candidate, registry, options),
    /inventory is not explicitly complete/,
    "Feature inventory must be explicitly complete.",
  );

  const missingTargetMark = structuredClone(completed);
  missingTargetMark.items[0].annotation.focusMarksObserved = [];
  assert.throws(
    () => validateFeatureAnnotation(missingTargetMark, candidate, registry, options),
    /missing required observed mark sukun/,
    "Sukun annotation must explicitly record observed sukun.",
  );

  const laterFeatureLeak = structuredClone(completed);
  laterFeatureLeak.items[0].annotation.focusMarksObserved = ["sukun", "shaddah"];
  assert.throws(
    () => validateFeatureAnnotation(laterFeatureLeak, candidate, registry, options),
    /forbidden observed mark shaddah/,
    "Sukun annotation must reject later-stage shaddah leakage.",
  );

  const articleLeak = structuredClone(completed);
  articleLeak.items[0].annotation.articleClassObserved = ["qamariyyah"];
  assert.throws(
    () => validateFeatureAnnotation(articleLeak, candidate, registry, options),
    /introduces article behavior/,
    "Sukun annotation must reject article leakage.",
  );

  const multiWordLeak = structuredClone(completed);
  multiWordLeak.items[0].annotation.materialShapeObserved = "two_words";
  assert.throws(
    () => validateFeatureAnnotation(multiWordLeak, candidate, registry, options),
    /material shape/,
    "Sukun annotation must remain isolated-word material.",
  );

  const unsupportedMark = structuredClone(completed);
  unsupportedMark.items[0].annotation.focusMarksObserved = ["sukun", "unknown_mark"];
  assert.throws(
    () => validateFeatureAnnotation(unsupportedMark, candidate, registry, options),
    /unsupported value/,
    "Feature annotation must reject uncontrolled metadata vocabulary.",
  );

  console.log("Progressive item-level qualified-human feature annotation gate passed.");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
