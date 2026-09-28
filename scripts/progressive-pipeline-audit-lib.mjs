import fs from "node:fs";
import path from "node:path";
import {
  buildControlledManifestReviewTemplate,
  loadFeatureAnnotationPolicy,
  readJson,
  sha256Bytes,
  validateAnnotatedCandidate,
  validateControlledManifestReview,
  validateFeatureAnnotation,
  validatePromotedCandidate,
  validateReviewedCandidate,
} from "./progressive-verification-lib.mjs";

const ARTIFACT_DIRECTORIES = {
  promoted: "public/content/source-intake/promoted",
  annotation: "public/content/source-intake/annotations",
  annotated: "public/content/source-intake/annotated",
  review: "public/content/source-intake/reviews",
  reviewed: "public/content/source-intake/reviewed",
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function repositoryRelative(repoRoot, absolute) {
  return path.relative(repoRoot, absolute).split(path.sep).join("/");
}

function artifactPath(repoRoot, kind, moduleId) {
  return path.resolve(repoRoot, ARTIFACT_DIRECTORIES[kind], `${moduleId}.json`);
}

function readArtifactIfPresent(repoRoot, kind, moduleId) {
  const absolute = artifactPath(repoRoot, kind, moduleId);
  if (!fs.existsSync(absolute)) return null;
  assert(fs.statSync(absolute).isFile(), `${kind} artifact path is not a file for ${moduleId}.`);
  const bytes = fs.readFileSync(absolute);
  return {
    path: repositoryRelative(repoRoot, absolute),
    sha256: sha256Bytes(bytes),
    value: JSON.parse(bytes.toString("utf8")),
  };
}

function promotedSubsetFiles(repoRoot, moduleId) {
  const directory = path.resolve(repoRoot, ARTIFACT_DIRECTORIES.promoted);
  if (!fs.existsSync(directory)) return [];
  assert(fs.statSync(directory).isDirectory(), "Promoted artifact root must be a directory.");
  const exact = `${moduleId}.json`;
  return fs.readdirSync(directory)
    .filter((name) => name !== exact && name.startsWith(`${moduleId}-`) && name.endsWith(".json"))
    .sort()
    .map((name) => repositoryRelative(repoRoot, path.join(directory, name)));
}

function candidateBundleRelative(module) {
  return module.candidateBundle?.startsWith("/content/")
    ? `public${module.candidateBundle}`
    : module.candidateBundle?.replace(/^\/+/, "");
}

function validateRegisteredCandidateBundle(module, registry, repoRoot) {
  const relative = candidateBundleRelative(module);
  assert(relative, `Candidate-backed module ${module.id} is missing candidateBundle.`);
  const absolute = path.resolve(repoRoot, relative);
  assert(fs.existsSync(absolute) && fs.statSync(absolute).isFile(), `Registered candidate bundle is missing for ${module.id}.`);
  const bundle = readJson(absolute);
  assert(bundle.kind === "itqan-progressive-provisional-transcription", `Registered candidate bundle kind is invalid for ${module.id}.`);
  assert(bundle.authoritative === false, `Registered candidate bundle must remain non-authoritative for ${module.id}.`);
  assert(bundle.sourceDocumentId === registry.sourceDocument.id, `Registered candidate bundle source drifted for ${module.id}.`);
  assert(bundle.moduleId === module.id, `Registered candidate bundle module drifted for ${module.id}.`);
  assert(Array.isArray(bundle.items) && bundle.items.length > 0, `Registered candidate bundle is empty for ${module.id}.`);
  if (Number.isInteger(module.candidateCount) && module.candidateCount > 0) {
    assert(bundle.items.length === module.candidateCount, `Registered candidate count drifted for ${module.id}.`);
  }
  const positions = new Set();
  for (const item of bundle.items) {
    assert(item.moduleId === module.id, `Registered candidate item escaped module ${module.id}.`);
    assert(module.sourcePdfPages?.includes(item.sourcePdfPage), `Registered candidate item uses an unexpected source page in ${module.id}.`);
    assert(Number.isInteger(item.sourceOrder) && item.sourceOrder > 0, `Registered candidate item has invalid source order in ${module.id}.`);
    const key = `${item.sourcePdfPage}:${item.sourceOrder}`;
    assert(!positions.has(key), `Registered candidate bundle duplicates source position ${key} in ${module.id}.`);
    positions.add(key);
  }
  return {
    path: relative,
    candidateCount: bundle.items.length,
  };
}

function validateAnnotationDraftIdentity(annotation, promoted, promotedSha256, registry, featurePolicy) {
  assert(annotation?.schemaVersion === "0.1", "Unsupported feature-annotation draft schema.");
  assert(annotation?.kind === "itqan-progressive-item-feature-annotation", "Unexpected feature-annotation draft kind.");
  assert(
    annotation.status === "pending_qualified_human_feature_annotation"
      || annotation.status === "qualified_human_feature_annotation_complete",
    "Unexpected feature-annotation status.",
  );
  const moduleId = promoted.verificationScope.moduleId;
  assert(annotation.sourceControl?.canonicalSourceId === registry.sourceDocument.id, "Feature-annotation draft source id drifted.");
  assert(annotation.sourceControl?.canonicalSourceSha256 === registry.sourceDocument.sha256, "Feature-annotation draft source SHA-256 drifted.");
  assert(annotation.sourceControl?.moduleId === moduleId, "Feature-annotation draft module drifted.");
  assert(annotation.sourceControl?.targetCategory === promoted.verificationScope.targetCategory, "Feature-annotation draft target category drifted.");
  assert(annotation.promotedCandidate?.sha256 === promotedSha256, "Feature-annotation draft promoted candidate SHA-256 drifted.");
  assert(annotation.promotedCandidate?.itemCount === promoted.items.length, "Feature-annotation draft item count drifted.");
  assert(annotation.featureAnnotationPolicy?.schemaVersion === featurePolicy.policy.schemaVersion, "Feature-annotation draft policy schema drifted.");
  assert(annotation.featureAnnotationPolicy?.sha256 === featurePolicy.sha256, "Feature-annotation draft policy SHA-256 drifted.");
  assert(annotation.annotationPolicy?.authority === "qualified_human", "Feature-annotation draft authority drifted.");
  assert(annotation.annotationPolicy?.linguisticInferenceByAgent === false, "Feature-annotation draft must forbid agent linguistic inference.");
  assert(Array.isArray(annotation.items) && annotation.items.length === promoted.items.length, "Feature-annotation draft must cover every promoted item.");

  const promotedById = new Map(promoted.items.map((item) => [item.id, item]));
  const seen = new Set();
  for (const item of annotation.items) {
    const promotedItem = promotedById.get(item.id);
    assert(promotedItem, `Feature-annotation draft references unknown promoted item ${String(item.id)}.`);
    assert(!seen.has(item.id), `Feature-annotation draft duplicates item ${item.id}.`);
    seen.add(item.id);
    assert(item.sourcePdfPage === promotedItem.source.pdfPage, `Feature-annotation draft source page drifted for ${item.id}.`);
    assert(item.sourceOrder === promotedItem.source.sourceOrder, `Feature-annotation draft source order drifted for ${item.id}.`);
    assert(item.arabicUtf8Sha256 === promotedItem.integrity.utf8Sha256, `Feature-annotation draft Arabic hash drifted for ${item.id}.`);
  }
}

function validateReviewDraftIdentity(
  review,
  {
    annotated,
    promoted,
    annotation,
    registry,
    promotedSha256,
    annotationSha256,
    annotatedSha256,
    repoRoot,
  },
) {
  assert(
    review?.status === "pending_qualified_content_review"
      || review?.status === "qualified_content_review_complete",
    "Unexpected controlled-manifest review status.",
  );
  const expected = buildControlledManifestReviewTemplate(
    {
      annotatedCandidate: annotated,
      originalCandidate: promoted,
      featureAnnotation: annotation,
      registry,
    },
    {
      annotatedCandidateManifestSha256: annotatedSha256,
      candidateManifestSha256: promotedSha256,
      featureAnnotationManifestSha256: annotationSha256,
      evidenceRepoRoot: repoRoot,
      candidateRepoRoot: repoRoot,
      policyRepoRoot: repoRoot,
    },
  );

  assert(review.schemaVersion === expected.schemaVersion, "Controlled-manifest review schema drifted.");
  assert(review.kind === expected.kind, "Controlled-manifest review kind drifted.");
  assert(JSON.stringify(review.sourceControl) === JSON.stringify(expected.sourceControl), "Controlled-manifest review source scope drifted.");
  assert(JSON.stringify(review.inputs) === JSON.stringify(expected.inputs), "Controlled-manifest review input hashes drifted.");
  assert(JSON.stringify(review.reviewPolicy) === JSON.stringify(expected.reviewPolicy), "Controlled-manifest review policy drifted.");
  assert(Array.isArray(review.items) && review.items.length === expected.items.length, "Controlled-manifest review must cover every annotated item.");

  const expectedById = new Map(expected.items.map((item) => [item.id, item]));
  const seen = new Set();
  for (const item of review.items) {
    const expectedItem = expectedById.get(item.id);
    assert(expectedItem, `Controlled-manifest review references unknown item ${String(item.id)}.`);
    assert(!seen.has(item.id), `Controlled-manifest review duplicates item ${item.id}.`);
    seen.add(item.id);
    for (const field of ["sourcePdfPage", "sourceOrder", "arabicUtf8Sha256", "controlledMetadataSha256"]) {
      assert(item[field] === expectedItem[field], `Controlled-manifest review ${field} drifted for ${item.id}.`);
    }
    const decision = item.review;
    assert(decision && typeof decision === "object", `Controlled-manifest review decision is missing for ${item.id}.`);
    for (const field of [
      "exactBytesAndHashReviewed",
      "evidenceBindingReviewed",
      "featureMetadataReviewed",
      "exerciseAuthorizationReviewed",
      "stagePurityReviewed",
      "reviewedByQualifiedContentReviewer",
    ]) {
      assert(typeof decision[field] === "boolean", `Controlled-manifest review ${field} must be boolean for ${item.id}.`);
    }
    assert([null, "approve", "reject"].includes(decision.decision), `Controlled-manifest review decision is invalid for ${item.id}.`);
    assert(typeof decision.notes === "string", `Controlled-manifest review notes must be a string for ${item.id}.`);
  }
}

function describeArtifact(artifact) {
  return artifact ? { path: artifact.path, sha256: artifact.sha256, status: artifact.value?.status ?? null } : null;
}

export function auditProgressivePipelineState({
  repoRoot = process.cwd(),
  registryPath = "public/content/source-intake/progressive-support.json",
} = {}) {
  const absoluteRegistry = path.resolve(repoRoot, registryPath);
  const registry = readJson(absoluteRegistry);
  const featurePolicy = loadFeatureAnnotationPolicy(repoRoot);
  const modules = [];
  const failures = [];

  for (const module of registry.modules ?? []) {
    if (!module.candidateBundle) continue;

    const report = {
      moduleId: module.id,
      targetCategory: module.targetCategory,
      stage: null,
      nextRequiredArtifact: null,
      candidate: null,
      artifacts: {},
      promotedSubsetFiles: [],
    };

    try {
      report.candidate = validateRegisteredCandidateBundle(module, registry, repoRoot);
      report.promotedSubsetFiles = promotedSubsetFiles(repoRoot, module.id);

      const promotedArtifact = readArtifactIfPresent(repoRoot, "promoted", module.id);
      const annotationArtifact = readArtifactIfPresent(repoRoot, "annotation", module.id);
      const annotatedArtifact = readArtifactIfPresent(repoRoot, "annotated", module.id);
      const reviewArtifact = readArtifactIfPresent(repoRoot, "review", module.id);
      const reviewedArtifact = readArtifactIfPresent(repoRoot, "reviewed", module.id);

      report.artifacts = {
        promoted: describeArtifact(promotedArtifact),
        annotation: describeArtifact(annotationArtifact),
        annotated: describeArtifact(annotatedArtifact),
        review: describeArtifact(reviewArtifact),
        reviewed: describeArtifact(reviewedArtifact),
      };

      if (!promotedArtifact) {
        assert(!annotationArtifact && !annotatedArtifact && !reviewArtifact && !reviewedArtifact, "Downstream progressive artifacts exist without the module-level promoted candidate.");
        if (report.promotedSubsetFiles.length > 0) {
          report.stage = "promoted_subsets_pending_aggregation";
          report.nextRequiredArtifact = "aggregate_module_promoted_candidate";
        } else {
          report.stage = "candidate_ready_for_human_verification";
          report.nextRequiredArtifact = "qualified_human_verification_and_repository_evidence";
        }
        modules.push(report);
        continue;
      }

      const promoted = promotedArtifact.value;
      validatePromotedCandidate(promoted, registry, {
        evidenceRepoRoot: repoRoot,
        candidateRepoRoot: repoRoot,
      });

      if (!annotationArtifact) {
        assert(!annotatedArtifact && !reviewArtifact && !reviewedArtifact, "Downstream progressive artifacts exist without a feature annotation.");
        report.stage = "promoted_pending_feature_annotation";
        report.nextRequiredArtifact = "qualified_human_feature_annotation";
        modules.push(report);
        continue;
      }

      const annotation = annotationArtifact.value;
      validateAnnotationDraftIdentity(annotation, promoted, promotedArtifact.sha256, registry, featurePolicy);
      if (annotation.status === "pending_qualified_human_feature_annotation") {
        assert(!annotatedArtifact && !reviewArtifact && !reviewedArtifact, "Downstream progressive artifacts exist while feature annotation is still a draft.");
        report.stage = "feature_annotation_draft";
        report.nextRequiredArtifact = "complete_qualified_human_feature_annotation";
        modules.push(report);
        continue;
      }

      validateFeatureAnnotation(annotation, promoted, registry, {
        candidateManifestSha256: promotedArtifact.sha256,
        evidenceRepoRoot: repoRoot,
        candidateRepoRoot: repoRoot,
        policyRepoRoot: repoRoot,
      });

      if (!annotatedArtifact) {
        assert(!reviewArtifact && !reviewedArtifact, "Downstream progressive artifacts exist before feature annotation was applied.");
        report.stage = "feature_annotation_complete_pending_apply";
        report.nextRequiredArtifact = "apply_feature_annotation";
        modules.push(report);
        continue;
      }

      const annotated = annotatedArtifact.value;
      validateAnnotatedCandidate(annotated, promoted, annotation, registry, {
        candidateManifestSha256: promotedArtifact.sha256,
        evidenceRepoRoot: repoRoot,
        candidateRepoRoot: repoRoot,
        policyRepoRoot: repoRoot,
      });

      if (!reviewArtifact) {
        assert(!reviewedArtifact, "Reviewed candidate exists without a controlled-manifest review artifact.");
        report.stage = "annotated_pending_controlled_manifest_review";
        report.nextRequiredArtifact = "qualified_controlled_manifest_review";
        modules.push(report);
        continue;
      }

      const review = reviewArtifact.value;
      validateReviewDraftIdentity(review, {
        annotated,
        promoted,
        annotation,
        registry,
        promotedSha256: promotedArtifact.sha256,
        annotationSha256: annotationArtifact.sha256,
        annotatedSha256: annotatedArtifact.sha256,
        repoRoot,
      });

      if (review.status === "pending_qualified_content_review") {
        assert(!reviewedArtifact, "Reviewed candidate exists while controlled-manifest review is still a draft.");
        report.stage = "controlled_manifest_review_draft";
        report.nextRequiredArtifact = "complete_qualified_controlled_manifest_review";
        modules.push(report);
        continue;
      }

      validateControlledManifestReview(
        review,
        {
          annotatedCandidate: annotated,
          originalCandidate: promoted,
          featureAnnotation: annotation,
          registry,
        },
        {
          annotatedCandidateManifestSha256: annotatedArtifact.sha256,
          candidateManifestSha256: promotedArtifact.sha256,
          featureAnnotationManifestSha256: annotationArtifact.sha256,
          evidenceRepoRoot: repoRoot,
          candidateRepoRoot: repoRoot,
          policyRepoRoot: repoRoot,
        },
      );

      if (!reviewedArtifact) {
        report.stage = "controlled_manifest_review_complete_pending_apply";
        report.nextRequiredArtifact = "apply_controlled_manifest_review";
        modules.push(report);
        continue;
      }

      validateReviewedCandidate(
        reviewedArtifact.value,
        annotated,
        review,
        {
          originalCandidate: promoted,
          featureAnnotation: annotation,
          registry,
        },
        {
          annotatedCandidateManifestSha256: annotatedArtifact.sha256,
          candidateManifestSha256: promotedArtifact.sha256,
          featureAnnotationManifestSha256: annotationArtifact.sha256,
          evidenceRepoRoot: repoRoot,
          candidateRepoRoot: repoRoot,
          policyRepoRoot: repoRoot,
        },
      );

      report.stage = "reviewed_pending_session_policy_rebuild";
      report.nextRequiredArtifact = "session_policy_rebuild";
      modules.push(report);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report.stage = "invalid_repository_state";
      report.nextRequiredArtifact = "repair_repository_artifact_chain";
      report.error = message;
      failures.push({ moduleId: module.id, error: message });
      modules.push(report);
    }
  }

  const stageCounts = {};
  for (const module of modules) {
    stageCounts[module.stage] = (stageCounts[module.stage] ?? 0) + 1;
  }

  return {
    schemaVersion: "0.1",
    kind: "itqan-progressive-pipeline-state-audit",
    sourceDocumentId: registry.sourceDocument?.id,
    sourceDocumentSha256: registry.sourceDocument?.sha256,
    featureAnnotationPolicySha256: featurePolicy.sha256,
    candidateBackedModuleCount: modules.length,
    stageCounts,
    failures,
    modules,
  };
}
