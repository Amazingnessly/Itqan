import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  CONTROLLED_MANIFEST_REVIEW_KIND,
  PROMOTED_KIND,
  REVIEWED_CANDIDATE_STATUS,
  applyControlledManifestReview,
  applyFeatureAnnotation,
  buildControlledManifestReviewTemplate,
  buildFeatureAnnotationTemplate,
  readJson,
  sha256Bytes,
  sha256TextExact,
  validateControlledManifestReview,
  validateReviewedCandidate,
} from "./progressive-verification-lib.mjs";

const registry = readJson("public/content/source-intake/progressive-support.json");
const module = registry.modules.find((entry) => entry.id === "sukun");
assert.ok(module?.candidateBundle, "Sukun module must expose a registered candidate bundle.");
const sourceCandidates = readJson("public" + module.candidateBundle);
const sourcePosition = sourceCandidates.items[0];
assert.ok(sourcePosition, "Controlled-manifest review fixture requires one registered source position.");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "itqan-controlled-review-"));
const evidenceDir = path.join(tempRoot, "public/content/evidence/controlled-review-test");
fs.mkdirSync(evidenceDir, { recursive: true });

try {
  const fullRelative = "public/content/evidence/controlled-review-test/p048-full.bin";
  const cropRelative = "public/content/evidence/controlled-review-test/p048-o001-crop.bin";
  const fullBytes = Buffer.from("full-page-proof", "utf8");
  const cropBytes = Buffer.from("crop-proof", "utf8");
  fs.writeFileSync(path.join(tempRoot, fullRelative), fullBytes);
  fs.writeFileSync(path.join(tempRoot, cropRelative), cropBytes);

  const exact = "synthetic-controlled-review-bytes";
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
        id: `ITQAN-PROG-SUKUN-P${String(sourcePosition.sourcePdfPage).padStart(3, "0")}-${String(sourcePosition.sourceOrder).padStart(3, "0")}`,
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
  const candidateManifestSha256 = sha256Bytes(candidateBytes);
  const featureOptions = {
    candidateManifestSha256,
    evidenceRepoRoot: tempRoot,
    candidateRepoRoot: process.cwd(),
    policyRepoRoot: process.cwd(),
  };

  const annotation = buildFeatureAnnotationTemplate(candidate, registry, featureOptions);
  annotation.status = "qualified_human_feature_annotation_complete";
  annotation.items[0].annotation = {
    focusMarksObserved: ["sukun"],
    articleClassObserved: [],
    materialShapeObserved: "isolated_word",
    hamzatWaslCandidate: false,
    featureInventoryComplete: true,
    targetFeatureConfirmed: true,
    stagePurityConfirmed: true,
    reviewedByQualifiedHuman: true,
    ambiguous: false,
    notes: "Qualified-human feature fixture.",
  };

  const annotationBytes = Buffer.from(JSON.stringify(annotation, null, 2) + "\n", "utf8");
  const featureAnnotationManifestSha256 = sha256Bytes(annotationBytes);
  const annotated = applyFeatureAnnotation(candidate, annotation, registry, featureOptions);
  const annotatedBytes = Buffer.from(JSON.stringify(annotated, null, 2) + "\n", "utf8");
  const annotatedCandidateManifestSha256 = sha256Bytes(annotatedBytes);

  const reviewOptions = {
    annotatedCandidateManifestSha256,
    candidateManifestSha256,
    featureAnnotationManifestSha256,
    evidenceRepoRoot: tempRoot,
    candidateRepoRoot: process.cwd(),
    policyRepoRoot: process.cwd(),
  };

  const template = buildControlledManifestReviewTemplate(
    {
      annotatedCandidate: annotated,
      originalCandidate: candidate,
      featureAnnotation: annotation,
      registry,
    },
    reviewOptions,
  );

  assert.equal(template.kind, CONTROLLED_MANIFEST_REVIEW_KIND);
  assert.equal(template.status, "pending_qualified_content_review");
  assert.equal(template.items.length, 1);
  assert.equal(template.items[0].arabicUtf8Sha256, candidate.items[0].integrity.utf8Sha256);
  assert.equal(template.items[0].review.decision, null);
  assert.equal(template.items[0].review.reviewedByQualifiedContentReviewer, false);
  assert.ok(!JSON.stringify(template).includes(exact), "Controlled-manifest review template must not copy Arabic text.");

  const completed = structuredClone(template);
  completed.status = "qualified_content_review_complete";
  completed.items[0].review = {
    exactBytesAndHashReviewed: true,
    evidenceBindingReviewed: true,
    featureMetadataReviewed: true,
    exerciseAuthorizationReviewed: true,
    stagePurityReviewed: true,
    decision: "approve",
    reviewedByQualifiedContentReviewer: true,
    notes: "Controlled-manifest fixture approved.",
  };

  const validated = validateControlledManifestReview(
    completed,
    {
      annotatedCandidate: annotated,
      originalCandidate: candidate,
      featureAnnotation: annotation,
      registry,
    },
    reviewOptions,
  );
  assert.equal(validated.items.length, 1);

  const reviewed = applyControlledManifestReview(
    annotated,
    completed,
    {
      originalCandidate: candidate,
      featureAnnotation: annotation,
      registry,
    },
    reviewOptions,
  );
  assert.equal(reviewed.status, REVIEWED_CANDIDATE_STATUS);
  assert.deepEqual(reviewed.activationPolicy.blockers, ["session_policy_rebuild_required"]);
  assert.equal(reviewed.activationPolicy.eligibleForActiveLesson, false);
  assert.equal(reviewed.activationPolicy.active, false);
  assert.equal(reviewed.items[0].eligibleForActiveLesson, false);
  assert.equal(reviewed.items[0].active, false);
  assert.equal(reviewed.items[0].metadataStatus, "controlled_manifest_reviewed_pending_session_policy_rebuild");
  assert.equal(reviewed.controlledManifestReview.everyItemApproved, true);
  assert.equal(reviewed.controlledManifestReview.contentRewriteApplied, false);
  assert.equal(reviewed.controlledManifestReview.activationApplied, false);
  assert.deepEqual(
    validateReviewedCandidate(
      reviewed,
      annotated,
      completed,
      {
        originalCandidate: candidate,
        featureAnnotation: annotation,
        registry,
      },
      reviewOptions,
    ),
    reviewed,
  );

  const reject = structuredClone(completed);
  reject.items[0].review.decision = "reject";
  assert.throws(
    () => validateControlledManifestReview(
      reject,
      {
        annotatedCandidate: annotated,
        originalCandidate: candidate,
        featureAnnotation: annotation,
        registry,
      },
      reviewOptions,
    ),
    /not explicitly approved/,
    "A rejected item must prevent a complete controlled-manifest review.",
  );

  const unchecked = structuredClone(completed);
  unchecked.items[0].review.stagePurityReviewed = false;
  assert.throws(
    () => validateControlledManifestReview(
      unchecked,
      {
        annotatedCandidate: annotated,
        originalCandidate: candidate,
        featureAnnotation: annotation,
        registry,
      },
      reviewOptions,
    ),
    /stage purity was not explicitly reviewed/,
    "Every controlled-manifest review check must be explicit.",
  );

  const metadataDrift = structuredClone(completed);
  metadataDrift.items[0].controlledMetadataSha256 = "0".repeat(64);
  assert.throws(
    () => validateControlledManifestReview(
      metadataDrift,
      {
        annotatedCandidate: annotated,
        originalCandidate: candidate,
        featureAnnotation: annotation,
        registry,
      },
      reviewOptions,
    ),
    /controlled metadata hash drifted/,
    "Controlled-manifest review must fail if item metadata changes.",
  );

  const candidateDrift = structuredClone(completed);
  candidateDrift.inputs.annotatedCandidateSha256 = "1".repeat(64);
  assert.throws(
    () => validateControlledManifestReview(
      candidateDrift,
      {
        annotatedCandidate: annotated,
        originalCandidate: candidate,
        featureAnnotation: annotation,
        registry,
      },
      reviewOptions,
    ),
    /annotated candidate SHA-256 drifted/,
    "Controlled-manifest review must bind the exact annotated candidate bytes.",
  );

  const missingItem = structuredClone(completed);
  missingItem.items = [];
  assert.throws(
    () => validateControlledManifestReview(
      missingItem,
      {
        annotatedCandidate: annotated,
        originalCandidate: candidate,
        featureAnnotation: annotation,
        registry,
      },
      reviewOptions,
    ),
    /cover every annotated item exactly once/,
    "Controlled-manifest review must forbid silent item exclusion.",
  );

  const tamperedReviewed = structuredClone(reviewed);
  tamperedReviewed.activationPolicy.eligibleForActiveLesson = true;
  assert.throws(
    () => validateReviewedCandidate(
      tamperedReviewed,
      annotated,
      completed,
      {
        originalCandidate: candidate,
        featureAnnotation: annotation,
        registry,
      },
      reviewOptions,
    ),
    /deterministic application/,
    "Controlled-manifest review must not make items eligible for active lessons.",
  );

  console.log("Progressive controlled-manifest review gate passed.");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
