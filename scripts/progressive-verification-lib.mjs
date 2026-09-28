import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const VERIFICATION_KIND = "itqan-progressive-human-verification";
export const EVIDENCE_KIND = "itqan-progressive-repository-evidence-map";
export const PROMOTED_KIND = "itqan-progressive-controlled-manifest-candidate";
export const FEATURE_ANNOTATION_KIND = "itqan-progressive-item-feature-annotation";
export const ANNOTATED_CANDIDATE_STATUS = "human_verified_repository_evidence_bound_item_metadata_annotated_pending_controlled_manifest_review";
export const CONTROLLED_MANIFEST_REVIEW_KIND = "itqan-progressive-controlled-manifest-review";
export const REVIEWED_CANDIDATE_STATUS = "controlled_manifest_reviewed_pending_session_policy_rebuild";

export function readJson(jsonPath) {
  return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
}

export function sha256Bytes(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function sha256TextExact(value) {
  return sha256Bytes(Buffer.from(value, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function resolveModule(registry, moduleId) {
  const matches = (registry.modules ?? []).filter((entry) => entry.id === moduleId);
  assert(matches.length === 1, `Verification module must resolve exactly once in the registry: ${moduleId}`);
  return matches[0];
}

function candidateBundlePath(module, repoRoot = process.cwd()) {
  if (!module.candidateBundle) return null;
  const relative = module.candidateBundle.startsWith("/content/")
    ? `public${module.candidateBundle}`
    : module.candidateBundle.replace(/^\/+/, "");
  const absolute = path.resolve(repoRoot, relative);
  assert(fs.existsSync(absolute) && fs.statSync(absolute).isFile(), `Registered candidate bundle is missing for ${module.id}.`);
  return absolute;
}

function registeredCandidatePositions(module, registry, repoRoot = process.cwd()) {
  const bundlePath = candidateBundlePath(module, repoRoot);
  if (!bundlePath) return null;
  const candidateBundle = readJson(bundlePath);
  assert(candidateBundle.kind === "itqan-progressive-provisional-transcription", `Registered candidate bundle kind is invalid for ${module.id}.`);
  assert(candidateBundle.authoritative === false, `Registered candidate bundle must remain non-authoritative for ${module.id}.`);
  assert(candidateBundle.sourceDocumentId === registry.sourceDocument?.id, `Registered candidate source does not match the registry for ${module.id}.`);
  assert(candidateBundle.moduleId === module.id, `Registered candidate bundle module does not match ${module.id}.`);
  return new Set((candidateBundle.items ?? []).map((item) => `${item.sourcePdfPage}:${item.sourceOrder}`));
}

function assertNoDuplicateSourcePositions(items, label) {
  const seen = new Set();
  for (const item of items) {
    const key = `${item.sourcePdfPage}:${item.sourceOrder}`;
    assert(!seen.has(key), `${label} contains duplicate source position ${key}.`);
    seen.add(key);
  }
}

export function validateHumanVerificationBundle(bundle, registry, { candidateRepoRoot = process.cwd() } = {}) {
  assert(bundle && typeof bundle === "object", "Verification bundle must be an object.");
  assert(bundle.schemaVersion === "0.2", "Unsupported human-verification schema.");
  assert(bundle.kind === VERIFICATION_KIND, "Unexpected human-verification kind.");
  assert(bundle.humanVerificationAuthority === true, "Human verification must be authoritative.");
  assert(bundle.candidateTranscriptionAuthoritative === false, "Provisional candidate transcription must remain non-authoritative.");
  assert(bundle.normalizationApplied === false, "Verification bundle must declare no normalization.");

  const source = registry.sourceDocument;
  assert(source && bundle.sourceDocument?.id === source.id, "Verification source document id does not match the registry.");
  assert(bundle.sourceDocument?.sha256 === source.sha256, "Verification source document SHA-256 does not match the registry.");

  const moduleId = bundle.verificationScope?.moduleId;
  assert(typeof moduleId === "string" && moduleId.length > 0, "Verification bundle must be scoped to one module.");
  const module = resolveModule(registry, moduleId);
  assert(bundle.verificationScope?.targetCategory === module.targetCategory, "Verification target category does not match the source registry.");

  const items = bundle.items;
  assert(Array.isArray(items) && items.length > 0, "Verification bundle must contain at least one item.");
  if (Number.isInteger(module.candidateCount) && module.candidateCount > 0) {
    assert(items.length <= module.candidateCount, `Verification subset cannot exceed the registered candidate count for ${moduleId}.`);
  }
  assertNoDuplicateSourcePositions(items, "Verification bundle");

  const registeredPositions = registeredCandidatePositions(module, registry, candidateRepoRoot);
  if (registeredPositions) {
    for (const item of items) {
      const key = `${item.sourcePdfPage}:${item.sourceOrder}`;
      assert(registeredPositions.has(key), `Verification source position is not present in the registered candidate bundle: ${key}.`);
    }
  }

  const scope = bundle.verificationScope ?? {};
  if (scope.coverage !== undefined) {
    assert(scope.coverage === "source_subset", "Verification coverage must be source_subset.");
  }
  if (scope.candidateCountInModule !== undefined) {
    assert(scope.candidateCountInModule === module.candidateCount, "Verification scope candidate count does not match the registry.");
  }
  if (scope.itemCount !== undefined) {
    assert(scope.itemCount === items.length, "Verification scope item count does not match the exported items.");
  }
  if (scope.sourcePositions !== undefined) {
    assert(Array.isArray(scope.sourcePositions), "Verification scope source positions must be an array.");
    const exportedPositions = items.map((item) => ({ sourcePdfPage: item.sourcePdfPage, sourceOrder: item.sourceOrder }));
    assert(JSON.stringify(scope.sourcePositions) === JSON.stringify(exportedPositions), "Verification scope source positions do not match the exported items.");
  }

  for (const [index, item] of items.entries()) {
    const label = `Verification item ${index + 1}`;
    assert(item.moduleId === moduleId, `${label} escaped the selected module.`);
    assert(module.sourcePdfPages?.includes(item.sourcePdfPage), `${label} uses an unexpected source page.`);
    assert(Number.isInteger(item.sourceOrder) && item.sourceOrder > 0, `${label} has invalid source order.`);
    assert(typeof item.arabicExact === "string" && item.arabicExact.length > 0, `${label} exact text is empty.`);
    assert(item.arabicExact === item.arabicExact.trim(), `${label} contains leading or trailing whitespace.`);

    const expectedHash = sha256TextExact(item.arabicExact);
    assert(item.integrity?.utf8Sha256 === expectedHash, `${label} exact UTF-8 hash does not match.`);
    assert(item.integrity?.normalizationApplied === false, `${label} must declare no normalization.`);
    assert(item.integrity?.differsFromNfc === (item.arabicExact.normalize("NFC") !== item.arabicExact), `${label} NFC observation does not match the exact bytes.`);

    assert(item.verification?.visualPass1 === true, `${label} is missing visual pass 1.`);
    assert(item.verification?.visualPass2 === true, `${label} is missing visual pass 2.`);
    assert(item.verification?.reviewedAmbiguity === true, `${label} ambiguity was not explicitly reviewed.`);
    assert(item.verification?.ambiguous === false, `${label} remains ambiguous.`);
    assert(item.verification?.humanVerified === true, `${label} is not marked human verified.`);
  }

  return { module, items };
}


function sourcePositionFromKey(key) {
  const [page, order] = key.split(":").map(Number);
  return { sourcePdfPage: page, sourceOrder: order };
}

function compareSourcePositions(left, right) {
  return left.sourcePdfPage - right.sourcePdfPage || left.sourceOrder - right.sourceOrder;
}

export function auditHumanVerificationCoverage(
  bundles,
  registry,
  { candidateRepoRoot = process.cwd() } = {},
) {
  assert(Array.isArray(bundles) && bundles.length > 0, "At least one human-verification bundle is required.");

  const validated = bundles.map((bundle) =>
    validateHumanVerificationBundle(bundle, registry, { candidateRepoRoot }),
  );
  const module = validated[0].module;
  for (const entry of validated) {
    assert(entry.module.id === module.id, "All human-verification subsets must belong to the same module.");
    assert(entry.module.targetCategory === module.targetCategory, "All human-verification subsets must use the same target category.");
  }

  const registeredPositions = registeredCandidatePositions(module, registry, candidateRepoRoot);
  assert(registeredPositions !== null, `Verification coverage audit requires a registered candidate bundle for ${module.id}.`);

  const seenPositions = new Map();
  const subsetSummaries = validated.map((entry, index) => {
    const bundle = bundles[index];
    const sourcePositions = entry.items
      .map((item) => ({
        sourcePdfPage: item.sourcePdfPage,
        sourceOrder: item.sourceOrder,
      }))
      .sort(compareSourcePositions);

    for (const position of sourcePositions) {
      const key = `${position.sourcePdfPage}:${position.sourceOrder}`;
      const previousSubset = seenPositions.get(key);
      assert(
        previousSubset === undefined,
        `Human-verification subsets overlap at source position ${key} (subsets ${previousSubset + 1} and ${index + 1}).`,
      );
      seenPositions.set(key, index);
    }

    return {
      subsetIndex: index + 1,
      itemCount: entry.items.length,
      partIndex: bundle.verificationScope?.partIndex ?? null,
      partCount: bundle.verificationScope?.partCount ?? null,
      sourcePositions,
    };
  });

  const verifiedSourcePositions = [...seenPositions.keys()]
    .map(sourcePositionFromKey)
    .sort(compareSourcePositions);
  const missingSourcePositions = [...registeredPositions]
    .filter((key) => !seenPositions.has(key))
    .map(sourcePositionFromKey)
    .sort(compareSourcePositions);

  return {
    schemaVersion: "0.1",
    kind: "itqan-progressive-human-verification-coverage-audit",
    sourceDocumentId: registry.sourceDocument?.id,
    sourceDocumentSha256: registry.sourceDocument?.sha256,
    moduleId: module.id,
    targetCategory: module.targetCategory,
    subsetCount: bundles.length,
    registeredCandidateCount: registeredPositions.size,
    verifiedItemCount: verifiedSourcePositions.length,
    registeredCandidateCoverageComplete: missingSourcePositions.length === 0,
    verifiedSourcePositions,
    missingSourcePositions,
    subsets: subsetSummaries,
  };
}


function normalizeEvidenceRoot(evidenceRoot, repoRoot = process.cwd()) {
  assert(typeof evidenceRoot === "string" && evidenceRoot.length > 0, "Evidence root is missing.");
  assert(!path.isAbsolute(evidenceRoot), "Evidence root must be repository-relative.");
  const normalized = evidenceRoot.replaceAll("\\", "/").replace(/\/+$/, "");
  assert(
    normalized.startsWith("public/content/evidence/"),
    "Evidence root must live under public/content/evidence/.",
  );
  assert(!normalized.split("/").includes(".."), "Evidence root must not traverse outside the repository.");
  const absolute = path.resolve(repoRoot, normalized);
  const evidenceRootAbsolute = path.resolve(repoRoot, "public/content/evidence");
  assert(
    absolute.startsWith(evidenceRootAbsolute + path.sep),
    "Evidence root escaped public/content/evidence/.",
  );
  return normalized;
}

function moduleEvidenceToken(moduleId) {
  const token = moduleId.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "");
  assert(token.length > 0, "Module id cannot produce an evidence path token.");
  return token;
}

function plannedEvidencePaths(moduleId, sourcePdfPage, sourceOrder, evidenceRoot) {
  const moduleToken = moduleEvidenceToken(moduleId);
  const pageToken = String(sourcePdfPage).padStart(3, "0");
  const orderToken = String(sourceOrder).padStart(3, "0");
  const moduleRoot = `${evidenceRoot}/${moduleToken}`;
  return {
    full: `${moduleRoot}/p${pageToken}-full.png`,
    crop: `${moduleRoot}/p${pageToken}-o${orderToken}-crop.png`,
  };
}

export function buildRepositoryEvidenceWorklist(
  bundles,
  registry,
  {
    candidateRepoRoot = process.cwd(),
    evidenceRepoRoot = process.cwd(),
    evidenceRoot = "public/content/evidence/progressive",
  } = {},
) {
  const audit = auditHumanVerificationCoverage(bundles, registry, { candidateRepoRoot });
  const normalizedEvidenceRoot = normalizeEvidenceRoot(evidenceRoot, evidenceRepoRoot);
  const items = audit.verifiedSourcePositions.map((position) => ({
    ...position,
    evidence: plannedEvidencePaths(
      audit.moduleId,
      position.sourcePdfPage,
      position.sourceOrder,
      normalizedEvidenceRoot,
    ),
  }));

  const fullPageFiles = new Map();
  const cropFiles = [];
  for (const item of items) {
    const existing = fullPageFiles.get(item.evidence.full) ?? {
      path: item.evidence.full,
      role: "full_page",
      sourcePdfPage: item.sourcePdfPage,
      sourceOrders: [],
    };
    existing.sourceOrders.push(item.sourceOrder);
    fullPageFiles.set(item.evidence.full, existing);
    cropFiles.push({
      path: item.evidence.crop,
      role: "item_crop",
      sourcePdfPage: item.sourcePdfPage,
      sourceOrder: item.sourceOrder,
    });
  }

  return {
    schemaVersion: "0.1",
    kind: "itqan-progressive-repository-evidence-worklist",
    sourceDocumentId: audit.sourceDocumentId,
    sourceDocumentSha256: audit.sourceDocumentSha256,
    moduleId: audit.moduleId,
    targetCategory: audit.targetCategory,
    evidenceRoot: normalizedEvidenceRoot,
    verificationSubsetCount: audit.subsetCount,
    registeredCandidateCount: audit.registeredCandidateCount,
    verifiedItemCount: audit.verifiedItemCount,
    registeredCandidateCoverageComplete: audit.registeredCandidateCoverageComplete,
    items,
    requiredFiles: [
      ...[...fullPageFiles.values()].sort(
        (left, right) => left.sourcePdfPage - right.sourcePdfPage,
      ),
      ...cropFiles.sort(
        (left, right) =>
          left.sourcePdfPage - right.sourcePdfPage ||
          left.sourceOrder - right.sourceOrder,
      ),
    ],
    missingSourcePositions: audit.missingSourcePositions,
  };
}

export function buildRepositoryEvidenceMapFromVerification(
  bundle,
  registry,
  repoRoot = process.cwd(),
  { evidenceRoot = "public/content/evidence/progressive" } = {},
) {
  const { module, items } = validateHumanVerificationBundle(bundle, registry, {
    candidateRepoRoot: repoRoot,
  });
  const normalizedEvidenceRoot = normalizeEvidenceRoot(evidenceRoot, repoRoot);

  const evidenceItems = items.map((item, index) => {
    const planned = plannedEvidencePaths(
      module.id,
      item.sourcePdfPage,
      item.sourceOrder,
      normalizedEvidenceRoot,
    );
    const label = `Evidence for verification item ${index + 1}`;
    const full = resolveRepositoryEvidencePath(repoRoot, planned.full, `${label} full-page`);
    const crop = resolveRepositoryEvidencePath(repoRoot, planned.crop, `${label} crop`);
    assert(full.normalized !== crop.normalized, `${label} must use distinct full-page and crop files.`);

    return {
      sourcePdfPage: item.sourcePdfPage,
      sourceOrder: item.sourceOrder,
      evidence: {
        full: full.normalized,
        crop: crop.normalized,
      },
      integrity: {
        fullSha256: sha256Bytes(fs.readFileSync(full.absolute)),
        cropSha256: sha256Bytes(fs.readFileSync(crop.absolute)),
      },
    };
  });

  const evidenceMap = {
    schemaVersion: "0.1",
    kind: EVIDENCE_KIND,
    sourceDocumentId: registry.sourceDocument?.id,
    sourceDocumentSha256: registry.sourceDocument?.sha256,
    moduleId: module.id,
    evidenceRoot: normalizedEvidenceRoot,
    verificationScope: {
      coverage: "source_subset",
      itemCount: items.length,
      partIndex: bundle.verificationScope?.partIndex ?? null,
      partCount: bundle.verificationScope?.partCount ?? null,
      sourcePositions: items.map((item) => ({
        sourcePdfPage: item.sourcePdfPage,
        sourceOrder: item.sourceOrder,
      })),
    },
    items: evidenceItems,
  };

  validateRepositoryEvidenceMap(evidenceMap, bundle, registry, repoRoot);
  return evidenceMap;
}

function resolveRepositoryEvidencePath(repoRoot, relativePath, label) {
  assert(typeof relativePath === "string" && relativePath.length > 0, `${label} evidence path is missing.`);
  assert(!path.isAbsolute(relativePath), `${label} evidence path must be repository-relative.`);
  const normalized = relativePath.replaceAll("\\", "/");
  assert(normalized.startsWith("public/content/evidence/"), `${label} evidence must live under public/content/evidence/.`);
  assert(!normalized.split("/").includes(".."), `${label} evidence path must not traverse outside the repository.`);
  const absolute = path.resolve(repoRoot, relativePath);
  const evidenceRoot = path.resolve(repoRoot, "public/content/evidence");
  assert(absolute === evidenceRoot || absolute.startsWith(evidenceRoot + path.sep), `${label} evidence path escaped the evidence root.`);
  assert(fs.existsSync(absolute) && fs.statSync(absolute).isFile(), `${label} evidence file does not exist: ${relativePath}`);
  return { absolute, normalized };
}

export function validateRepositoryEvidenceMap(evidenceMap, bundle, registry, repoRoot = process.cwd()) {
  assert(evidenceMap && typeof evidenceMap === "object", "Evidence map must be an object.");
  assert(evidenceMap.schemaVersion === "0.1", "Unsupported evidence-map schema.");
  assert(evidenceMap.kind === EVIDENCE_KIND, "Unexpected evidence-map kind.");
  assert(evidenceMap.sourceDocumentId === registry.sourceDocument?.id, "Evidence map source id does not match the registry.");
  assert(evidenceMap.sourceDocumentSha256 === registry.sourceDocument?.sha256, "Evidence map source SHA-256 does not match the registry.");
  assert(evidenceMap.moduleId === bundle.verificationScope?.moduleId, "Evidence map module does not match the verification bundle.");
  if (evidenceMap.verificationScope !== undefined) {
    const scope = evidenceMap.verificationScope;
    assert(scope.coverage === "source_subset", "Evidence-map verification coverage must be source_subset.");
    assert(scope.itemCount === bundle.items.length, "Evidence-map verification item count does not match the bundle.");
    const expectedPositions = bundle.items.map((item) => ({
      sourcePdfPage: item.sourcePdfPage,
      sourceOrder: item.sourceOrder,
    }));
    assert(
      JSON.stringify(scope.sourcePositions) === JSON.stringify(expectedPositions),
      "Evidence-map verification source positions do not match the bundle.",
    );
    if (scope.partIndex !== null && scope.partIndex !== undefined) {
      assert(scope.partIndex === bundle.verificationScope?.partIndex, "Evidence-map part index does not match the verification bundle.");
    }
    if (scope.partCount !== null && scope.partCount !== undefined) {
      assert(scope.partCount === bundle.verificationScope?.partCount, "Evidence-map part count does not match the verification bundle.");
    }
  }
  assert(Array.isArray(evidenceMap.items), "Evidence map items must be an array.");
  assert(evidenceMap.items.length === bundle.items.length, "Evidence map must cover every verified item exactly once.");
  assertNoDuplicateSourcePositions(evidenceMap.items, "Evidence map");

  const evidenceByPosition = new Map(evidenceMap.items.map((item) => [`${item.sourcePdfPage}:${item.sourceOrder}`, item]));

  const validated = bundle.items.map((item, index) => {
    const key = `${item.sourcePdfPage}:${item.sourceOrder}`;
    const evidence = evidenceByPosition.get(key);
    const label = `Evidence for item ${index + 1}`;
    assert(evidence, `${label} is missing.`);

    const full = resolveRepositoryEvidencePath(repoRoot, evidence.evidence?.full, `${label} full-page`);
    const crop = resolveRepositoryEvidencePath(repoRoot, evidence.evidence?.crop, `${label} crop`);
    assert(full.normalized !== crop.normalized, `${label} must provide distinct full-page and crop evidence files.`);

    const fullHash = sha256Bytes(fs.readFileSync(full.absolute));
    const cropHash = sha256Bytes(fs.readFileSync(crop.absolute));
    assert(evidence.integrity?.fullSha256 === fullHash, `${label} full-page SHA-256 does not match repository bytes.`);
    assert(evidence.integrity?.cropSha256 === cropHash, `${label} crop SHA-256 does not match repository bytes.`);

    return {
      sourcePdfPage: item.sourcePdfPage,
      sourceOrder: item.sourceOrder,
      evidence: { full: full.normalized, crop: crop.normalized },
      integrity: { fullSha256: fullHash, cropSha256: cropHash },
    };
  });

  return validated;
}

function sourcePositionId(moduleId, page, order) {
  const moduleToken = moduleId.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `ITQAN-PROG-${moduleToken}-P${String(page).padStart(3, "0")}-${String(order).padStart(3, "0")}`;
}

export function buildControlledManifestCandidate(bundle, registry, validatedEvidence) {
  const { module, items } = validateHumanVerificationBundle(bundle, registry);
  const evidenceByPosition = new Map(validatedEvidence.map((item) => [`${item.sourcePdfPage}:${item.sourceOrder}`, item]));
  assert(validatedEvidence.length === items.length, "Validated evidence must cover every verified item.");

  return {
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
    items: items.map((item) => {
      const key = `${item.sourcePdfPage}:${item.sourceOrder}`;
      const evidence = evidenceByPosition.get(key);
      assert(evidence, `Validated evidence is missing for source position ${key}.`);
      return {
        id: sourcePositionId(module.id, item.sourcePdfPage, item.sourceOrder),
        source: {
          sourceId: registry.sourceDocument.id,
          file: registry.sourceDocument.uploadedFilename,
          pdfPage: item.sourcePdfPage,
          sourceOrder: item.sourceOrder,
        },
        arabicExact: item.arabicExact,
        integrity: {
          utf8Sha256: item.integrity.utf8Sha256,
          normalizationApplied: false,
        },
        verification: {
          visualPass1: true,
          visualPass1Method: "qualified_human_against_canonical_pdf",
          visualPass2: true,
          visualPass2Method: "qualified_human_second_pass_against_canonical_pdf",
          evidence: evidence.evidence,
          evidenceIntegrity: evidence.integrity,
          ambiguous: false,
        },
        candidateOrigin: item.candidateOrigin,
        allowedExerciseTypes: [module.targetCategory],
        metadataStatus: "pending_item_level_feature_annotation",
        eligibleForActiveLesson: false,
        active: false,
      };
    }),
  };
}

function promotedSourcePosition(item, label) {
  const page = item.source?.pdfPage;
  const order = item.source?.sourceOrder;
  assert(Number.isInteger(page) && page > 0, `${label} has invalid source page.`);
  assert(Number.isInteger(order) && order > 0, `${label} has invalid source order.`);
  return { page, order, key: `${page}:${order}` };
}

export function validatePromotedCandidate(
  candidate,
  registry,
  { evidenceRepoRoot = process.cwd(), candidateRepoRoot = process.cwd() } = {},
) {
  assert(candidate && typeof candidate === "object", "Promoted candidate must be an object.");
  assert(candidate.schemaVersion === "0.1", "Unsupported promoted-candidate schema.");
  assert(candidate.kind === PROMOTED_KIND, "Unexpected promoted-candidate kind.");
  assert(
    candidate.status === "human_verified_repository_evidence_bound_pending_item_metadata",
    "Promoted candidate status is invalid.",
  );

  const source = registry.sourceDocument;
  assert(candidate.sourceControl?.canonicalSourceId === source?.id, "Promoted candidate source id does not match the registry.");
  assert(candidate.sourceControl?.canonicalFile === source?.uploadedFilename, "Promoted candidate source file does not match the registry.");
  assert(candidate.sourceControl?.canonicalSha256 === source?.sha256, "Promoted candidate source SHA-256 does not match the registry.");
  assert(candidate.sourceControl?.visualPassesPerItem === 2, "Promoted candidate must preserve two visual passes.");
  assert(candidate.sourceControl?.silentNormalization === false, "Promoted candidate must preserve the no-normalization rule.");
  assert(candidate.sourceControl?.modelOrOcrUsedAsAuthority === false, "Promoted candidate must not treat model/OCR output as authority.");

  const moduleId = candidate.verificationScope?.moduleId;
  assert(typeof moduleId === "string" && moduleId.length > 0, "Promoted candidate must be scoped to one module.");
  const module = resolveModule(registry, moduleId);
  assert(candidate.verificationScope?.targetCategory === module.targetCategory, "Promoted candidate target category does not match the source registry.");

  assert(candidate.activationPolicy?.eligibleForActiveLesson === false, "Promoted candidate must remain ineligible for active lessons.");
  assert(candidate.activationPolicy?.active === false, "Promoted candidate must remain inactive.");
  const requiredBlockers = [
    "item_level_feature_metadata_required",
    "controlled_manifest_review_required",
    "session_policy_rebuild_required",
  ];
  for (const blocker of requiredBlockers) {
    assert(candidate.activationPolicy?.blockers?.includes(blocker), `Promoted candidate is missing activation blocker: ${blocker}.`);
  }

  const items = candidate.items;
  assert(Array.isArray(items) && items.length > 0, "Promoted candidate must contain at least one item.");
  const registeredPositions = registeredCandidatePositions(module, registry, candidateRepoRoot);
  const seenPositions = new Set();
  const seenIds = new Set();

  for (const [index, item] of items.entries()) {
    const label = `Promoted item ${index + 1}`;
    const position = promotedSourcePosition(item, label);
    assert(!seenPositions.has(position.key), `Promoted candidate contains duplicate source position ${position.key}.`);
    seenPositions.add(position.key);

    assert(typeof item.id === "string" && item.id.length > 0, `${label} id is missing.`);
    assert(!seenIds.has(item.id), `Promoted candidate contains duplicate item id ${item.id}.`);
    seenIds.add(item.id);
    assert(item.id === sourcePositionId(module.id, position.page, position.order), `${label} id does not match its deterministic source position id.`);

    assert(item.source?.sourceId === source.id, `${label} source id does not match the registry.`);
    assert(item.source?.file === source.uploadedFilename, `${label} source file does not match the registry.`);
    assert(module.sourcePdfPages?.includes(position.page), `${label} uses an unexpected source page.`);
    if (registeredPositions) {
      assert(registeredPositions.has(position.key), `${label} source position is not present in the registered candidate bundle: ${position.key}.`);
    }

    assert(typeof item.arabicExact === "string" && item.arabicExact.length > 0, `${label} exact text is empty.`);
    assert(item.arabicExact === item.arabicExact.trim(), `${label} contains leading or trailing whitespace.`);
    assert(item.integrity?.utf8Sha256 === sha256TextExact(item.arabicExact), `${label} exact UTF-8 hash does not match.`);
    assert(item.integrity?.normalizationApplied === false, `${label} must declare no normalization.`);

    assert(item.verification?.visualPass1 === true, `${label} is missing visual pass 1.`);
    assert(item.verification?.visualPass2 === true, `${label} is missing visual pass 2.`);
    assert(item.verification?.ambiguous === false, `${label} remains ambiguous.`);

    const full = resolveRepositoryEvidencePath(evidenceRepoRoot, item.verification?.evidence?.full, `${label} full-page`);
    const crop = resolveRepositoryEvidencePath(evidenceRepoRoot, item.verification?.evidence?.crop, `${label} crop`);
    assert(full.normalized !== crop.normalized, `${label} must preserve distinct full-page and crop evidence files.`);
    assert(item.verification?.evidenceIntegrity?.fullSha256 === sha256Bytes(fs.readFileSync(full.absolute)), `${label} full-page SHA-256 does not match repository bytes.`);
    assert(item.verification?.evidenceIntegrity?.cropSha256 === sha256Bytes(fs.readFileSync(crop.absolute)), `${label} crop SHA-256 does not match repository bytes.`);

    assert(
      Array.isArray(item.allowedExerciseTypes) &&
        item.allowedExerciseTypes.length === 1 &&
        item.allowedExerciseTypes[0] === module.targetCategory,
      `${label} allowed exercise type does not match the module target category.`,
    );
    assert(item.metadataStatus === "pending_item_level_feature_annotation", `${label} must remain pending item-level feature annotation.`);
    assert(item.eligibleForActiveLesson === false, `${label} must remain ineligible for active lessons.`);
    assert(item.active === false, `${label} must remain inactive.`);
  }

  return { module, items };
}


const FEATURE_ANNOTATION_POLICY_PATH = "public/content/source-intake/feature-annotation-policy.json";

const LOCKED_EXERCISE_CATEGORIES = new Set([
  "reading_units",
  "vowels_sukun",
  "shaddah",
  "article_al",
  "linking",
  "fluent_reading",
]);

const ARTICLE_POLICY_MODES = new Set(["none", "any", "shamsiyyah_only"]);

export function validateFeatureAnnotationPolicy(policy) {
  assert(policy && typeof policy === "object", "Feature-annotation policy must be an object.");
  assert(policy.schemaVersion === "0.1", "Unsupported feature-annotation policy schema.");
  assert(policy.kind === "itqan-progressive-feature-annotation-policy", "Unexpected feature-annotation policy kind.");

  const arabicPattern = /[\u0600-\u06ff]/u;
  assert(!arabicPattern.test(JSON.stringify(policy)), "Feature-annotation policy must not embed Arabic exercise content.");

  function controlledIds(entries, label) {
    assert(Array.isArray(entries) && entries.length > 0, `${label} must be a non-empty array.`);
    const ids = new Set();
    for (const entry of entries) {
      assert(typeof entry?.id === "string" && entry.id.length > 0, `${label} contains an invalid id.`);
      assert(typeof entry?.labelFr === "string" && entry.labelFr.length > 0, `${label} contains an invalid French label.`);
      assert(!ids.has(entry.id), `${label} contains duplicate id ${entry.id}.`);
      ids.add(entry.id);
    }
    return ids;
  }

  const focusMarks = controlledIds(policy.controlledFocusMarks, "Controlled focus marks");
  const articleClasses = controlledIds(policy.controlledArticleClasses, "Controlled article classes");
  const materialShapes = controlledIds(policy.controlledMaterialShapes, "Controlled material shapes");

  assert(Array.isArray(policy.modules) && policy.modules.length > 0, "Feature-annotation policy must define module rules.");
  const moduleIds = new Set();
  for (const module of policy.modules) {
    assert(typeof module?.id === "string" && module.id.length > 0, "Feature-annotation module rule id is missing.");
    assert(!moduleIds.has(module.id), `Feature-annotation policy contains duplicate module rule ${module.id}.`);
    moduleIds.add(module.id);
    assert(LOCKED_EXERCISE_CATEGORIES.has(module.targetCategory), `Feature-annotation module ${module.id} has unsupported target category.`);
    assert(materialShapes.has(module.materialShape), `Feature-annotation module ${module.id} has unsupported material shape.`);
    assert(ARTICLE_POLICY_MODES.has(module.articleClasses), `Feature-annotation module ${module.id} has unsupported article-class policy.`);
    assert(typeof module.guidanceFr === "string" && module.guidanceFr.length > 0, `Feature-annotation module ${module.id} guidance is missing.`);

    const required = new Set();
    assert(Array.isArray(module.requiredMarks), `Feature-annotation module ${module.id} requiredMarks must be an array.`);
    for (const mark of module.requiredMarks) {
      assert(focusMarks.has(mark), `Feature-annotation module ${module.id} requires unsupported mark ${String(mark)}.`);
      assert(!required.has(mark), `Feature-annotation module ${module.id} duplicates required mark ${mark}.`);
      required.add(mark);
    }

    const forbidden = new Set();
    assert(Array.isArray(module.forbiddenMarks), `Feature-annotation module ${module.id} forbiddenMarks must be an array.`);
    for (const mark of module.forbiddenMarks) {
      assert(focusMarks.has(mark), `Feature-annotation module ${module.id} forbids unsupported mark ${String(mark)}.`);
      assert(!forbidden.has(mark), `Feature-annotation module ${module.id} duplicates forbidden mark ${mark}.`);
      assert(!required.has(mark), `Feature-annotation module ${module.id} both requires and forbids mark ${mark}.`);
      forbidden.add(mark);
    }
  }

  assert(articleClasses.has("qamariyyah") && articleClasses.has("shamsiyyah"), "Feature-annotation article vocabulary must retain qamariyyah and shamsiyyah.");
  return {
    policy,
    focusMarks,
    articleClasses,
    materialShapes,
  };
}

export function loadFeatureAnnotationPolicy(repoRoot = process.cwd()) {
  const policyPath = path.resolve(repoRoot, FEATURE_ANNOTATION_POLICY_PATH);
  assert(fs.existsSync(policyPath) && fs.statSync(policyPath).isFile(), "Feature-annotation policy file is missing.");
  const bytes = fs.readFileSync(policyPath);
  const policy = JSON.parse(bytes.toString("utf8"));
  validateFeatureAnnotationPolicy(policy);
  return {
    policy,
    sha256: sha256Bytes(bytes),
    path: FEATURE_ANNOTATION_POLICY_PATH,
  };
}

function assertUniqueControlledValues(values, allowed, label) {
  assert(Array.isArray(values), `${label} must be an array.`);
  const seen = new Set();
  for (const value of values) {
    assert(typeof value === "string" && allowed.has(value), `${label} contains unsupported value: ${String(value)}.`);
    assert(!seen.has(value), `${label} contains duplicate value: ${value}.`);
    seen.add(value);
  }
}

function annotationStagePolicy(moduleId, targetCategory, policyContract) {
  const matches = policyContract.modules.filter((entry) => entry.id === moduleId);
  assert(matches.length === 1, `No unique item-level annotation stage policy is defined for module ${moduleId}.`);
  const policy = matches[0];
  assert(
    policy.targetCategory === targetCategory,
    `Annotation stage policy target category mismatch for ${moduleId}.`,
  );
  return policy;
}

function validateAnnotationStagePurity(annotationItem, module, policyContract) {
  const policy = annotationStagePolicy(module.id, module.targetCategory, policyContract);

  const metadata = annotationItem.annotation;
  assert(
    metadata.materialShapeObserved === policy.materialShape,
    `Feature annotation ${annotationItem.id} has material shape ${String(metadata.materialShapeObserved)} but ${module.id} requires ${policy.materialShape}.`,
  );

  const focusMarks = new Set(metadata.focusMarksObserved);
  for (const requiredMark of policy.requiredMarks) {
    assert(
      focusMarks.has(requiredMark),
      `Feature annotation ${annotationItem.id} is missing required observed mark ${requiredMark} for ${module.id}.`,
    );
  }
  for (const forbiddenMark of policy.forbiddenMarks) {
    assert(
      !focusMarks.has(forbiddenMark),
      `Feature annotation ${annotationItem.id} contains forbidden observed mark ${forbiddenMark} for ${module.id}.`,
    );
  }

  const articleClasses = metadata.articleClassObserved;
  if (policy.articleClasses === "none") {
    assert(
      articleClasses.length === 0,
      `Feature annotation ${annotationItem.id} introduces article behavior before the allowed stage for ${module.id}.`,
    );
  } else if (policy.articleClasses === "shamsiyyah_only") {
    assert(
      articleClasses.length === 1 && articleClasses[0] === "shamsiyyah",
      `Feature annotation ${annotationItem.id} must be shamsiyyah-only for ${module.id}.`,
    );
  }
}

export function buildFeatureAnnotationTemplate(
  candidate,
  registry,
  {
    candidateManifestSha256,
    evidenceRepoRoot = process.cwd(),
    candidateRepoRoot = process.cwd(),
    policyRepoRoot = process.cwd(),
  } = {},
) {
  assert(
    /^[a-f0-9]{64}$/.test(candidateManifestSha256 ?? ""),
    "Candidate manifest SHA-256 is required to prepare a feature-annotation template.",
  );
  const { module, items } = validatePromotedCandidate(candidate, registry, {
    evidenceRepoRoot,
    candidateRepoRoot,
  });
  const featurePolicy = loadFeatureAnnotationPolicy(policyRepoRoot);

  return {
    schemaVersion: "0.1",
    kind: FEATURE_ANNOTATION_KIND,
    status: "pending_qualified_human_feature_annotation",
    sourceControl: {
      canonicalSourceId: registry.sourceDocument.id,
      canonicalSourceSha256: registry.sourceDocument.sha256,
      moduleId: module.id,
      targetCategory: module.targetCategory,
    },
    promotedCandidate: {
      sha256: candidateManifestSha256,
      itemCount: items.length,
    },
    featureAnnotationPolicy: {
      schemaVersion: featurePolicy.policy.schemaVersion,
      sha256: featurePolicy.sha256,
    },
    annotationPolicy: {
      authority: "qualified_human",
      linguisticInferenceByAgent: false,
      featureInventoryMustBeComplete: true,
      targetFeatureMustBeHumanConfirmed: true,
      stagePurityMustBeHumanConfirmed: true,
    },
    items: items.map((item) => ({
      id: item.id,
      sourcePdfPage: item.source.pdfPage,
      sourceOrder: item.source.sourceOrder,
      arabicUtf8Sha256: item.integrity.utf8Sha256,
      annotation: {
        focusMarksObserved: [],
        articleClassObserved: [],
        materialShapeObserved: null,
        hamzatWaslCandidate: null,
        featureInventoryComplete: null,
        targetFeatureConfirmed: null,
        stagePurityConfirmed: null,
        reviewedByQualifiedHuman: false,
        ambiguous: null,
        notes: "",
      },
    })),
  };
}

export function validateFeatureAnnotation(
  annotation,
  candidate,
  registry,
  {
    candidateManifestSha256,
    evidenceRepoRoot = process.cwd(),
    candidateRepoRoot = process.cwd(),
    policyRepoRoot = process.cwd(),
  } = {},
) {
  assert(annotation && typeof annotation === "object", "Feature annotation must be an object.");
  assert(annotation.schemaVersion === "0.1", "Unsupported feature-annotation schema.");
  assert(annotation.kind === FEATURE_ANNOTATION_KIND, "Unexpected feature-annotation kind.");
  assert(
    annotation.status === "qualified_human_feature_annotation_complete",
    "Feature annotation must be explicitly marked complete by the qualified human.",
  );
  assert(annotation.annotationPolicy?.authority === "qualified_human", "Feature annotation authority must be qualified_human.");
  assert(annotation.annotationPolicy?.linguisticInferenceByAgent === false, "Feature annotation must declare no agent linguistic inference.");
  assert(annotation.annotationPolicy?.featureInventoryMustBeComplete === true, "Feature annotation must require a complete controlled-feature inventory.");
  assert(annotation.annotationPolicy?.targetFeatureMustBeHumanConfirmed === true, "Feature annotation must require target-feature confirmation.");
  assert(annotation.annotationPolicy?.stagePurityMustBeHumanConfirmed === true, "Feature annotation must require stage-purity confirmation.");

  assert(
    /^[a-f0-9]{64}$/.test(candidateManifestSha256 ?? ""),
    "Candidate manifest SHA-256 is required to validate feature annotation.",
  );
  assert(
    annotation.promotedCandidate?.sha256 === candidateManifestSha256,
    "Feature annotation promoted-candidate SHA-256 does not match the current candidate bytes.",
  );

  const featurePolicy = loadFeatureAnnotationPolicy(policyRepoRoot);
  assert(
    annotation.featureAnnotationPolicy?.schemaVersion === featurePolicy.policy.schemaVersion,
    "Feature annotation policy schema version does not match the current controlled policy.",
  );
  assert(
    annotation.featureAnnotationPolicy?.sha256 === featurePolicy.sha256,
    "Feature annotation policy SHA-256 does not match the current controlled policy bytes.",
  );
  const policyValidation = validateFeatureAnnotationPolicy(featurePolicy.policy);

  const { module, items } = validatePromotedCandidate(candidate, registry, {
    evidenceRepoRoot,
    candidateRepoRoot,
  });

  assert(annotation.sourceControl?.canonicalSourceId === registry.sourceDocument.id, "Feature annotation source id does not match the registry.");
  assert(annotation.sourceControl?.canonicalSourceSha256 === registry.sourceDocument.sha256, "Feature annotation source SHA-256 does not match the registry.");
  assert(annotation.sourceControl?.moduleId === module.id, "Feature annotation module does not match the promoted candidate.");
  assert(annotation.sourceControl?.targetCategory === module.targetCategory, "Feature annotation target category does not match the promoted candidate.");
  assert(annotation.promotedCandidate?.itemCount === items.length, "Feature annotation item count does not match the promoted candidate.");
  assert(Array.isArray(annotation.items) && annotation.items.length === items.length, "Feature annotation must cover every promoted item exactly once.");

  const candidateById = new Map(items.map((item) => [item.id, item]));
  const seen = new Set();
  const validatedAnnotations = [];

  for (const [index, annotationItem] of annotation.items.entries()) {
    const label = `Feature annotation item ${index + 1}`;
    assert(typeof annotationItem?.id === "string" && annotationItem.id.length > 0, `${label} id is missing.`);
    assert(!seen.has(annotationItem.id), `Feature annotation contains duplicate item id ${annotationItem.id}.`);
    seen.add(annotationItem.id);

    const candidateItem = candidateById.get(annotationItem.id);
    assert(candidateItem, `${label} does not exist in the promoted candidate: ${annotationItem.id}.`);
    assert(annotationItem.sourcePdfPage === candidateItem.source.pdfPage, `${label} source page drifted from the promoted candidate.`);
    assert(annotationItem.sourceOrder === candidateItem.source.sourceOrder, `${label} source order drifted from the promoted candidate.`);
    assert(annotationItem.arabicUtf8Sha256 === candidateItem.integrity.utf8Sha256, `${label} exact Arabic UTF-8 hash drifted from the promoted candidate.`);

    const metadata = annotationItem.annotation;
    assert(metadata && typeof metadata === "object", `${label} metadata is missing.`);
    assertUniqueControlledValues(metadata.focusMarksObserved, policyValidation.focusMarks, `${label} focusMarksObserved`);
    assertUniqueControlledValues(metadata.articleClassObserved, policyValidation.articleClasses, `${label} articleClassObserved`);
    assert(
      typeof metadata.materialShapeObserved === "string" && policyValidation.materialShapes.has(metadata.materialShapeObserved),
      `${label} materialShapeObserved is missing or unsupported.`,
    );
    assert(typeof metadata.hamzatWaslCandidate === "boolean", `${label} hamzatWaslCandidate must be explicitly true or false.`);
    assert(metadata.featureInventoryComplete === true, `${label} controlled-feature inventory is not explicitly complete.`);
    assert(metadata.targetFeatureConfirmed === true, `${label} target feature is not explicitly confirmed.`);
    assert(metadata.stagePurityConfirmed === true, `${label} stage purity is not explicitly confirmed.`);
    assert(metadata.reviewedByQualifiedHuman === true, `${label} is not marked reviewed by a qualified human.`);
    assert(metadata.ambiguous === false, `${label} remains ambiguous.`);
    assert(typeof metadata.notes === "string", `${label} notes must be a string.`);

    validateAnnotationStagePurity(annotationItem, module, featurePolicy.policy);
    validatedAnnotations.push(annotationItem);
  }

  for (const item of items) {
    assert(seen.has(item.id), `Feature annotation is missing promoted item ${item.id}.`);
  }

  return { module, items, annotations: validatedAnnotations };
}

export function applyFeatureAnnotation(
  candidate,
  annotation,
  registry,
  options = {},
) {
  const { module, items, annotations } = validateFeatureAnnotation(
    annotation,
    candidate,
    registry,
    options,
  );
  const annotationById = new Map(annotations.map((item) => [item.id, item.annotation]));

  return {
    ...candidate,
    status: ANNOTATED_CANDIDATE_STATUS,
    annotationControl: {
      schemaVersion: annotation.schemaVersion,
      kind: annotation.kind,
      authority: "qualified_human",
      linguisticInferenceByAgent: false,
      promotedCandidateSha256: annotation.promotedCandidate.sha256,
      featureAnnotationPolicySchemaVersion: annotation.featureAnnotationPolicy.schemaVersion,
      featureAnnotationPolicySha256: annotation.featureAnnotationPolicy.sha256,
      featureInventoryComplete: true,
    },
    activationPolicy: {
      eligibleForActiveLesson: false,
      active: false,
      blockers: [
        "controlled_manifest_review_required",
        "session_policy_rebuild_required",
      ],
    },
    items: items.map((item) => {
      const metadata = annotationById.get(item.id);
      assert(metadata, `Validated feature annotation missing for ${item.id}.`);
      return {
        ...item,
        focusMarksObserved: [...metadata.focusMarksObserved],
        articleClassObserved: [...metadata.articleClassObserved],
        materialShapeObserved: metadata.materialShapeObserved,
        hamzatWaslCandidate: metadata.hamzatWaslCandidate,
        targetFeatureConfirmed: true,
        stagePurityConfirmed: true,
        metadataStatus: "human_annotated_pending_controlled_manifest_review",
        eligibleForActiveLesson: false,
        active: false,
      };
    }),
    verificationScope: {
      ...candidate.verificationScope,
      moduleId: module.id,
      targetCategory: module.targetCategory,
      itemLevelFeatureMetadataComplete: true,
    },
  };
}

export function validateAnnotatedCandidate(
  annotatedCandidate,
  originalCandidate,
  annotation,
  registry,
  options = {},
) {
  const expected = applyFeatureAnnotation(originalCandidate, annotation, registry, options);
  assert(
    JSON.stringify(annotatedCandidate) === JSON.stringify(expected),
    "Annotated candidate does not match deterministic application of the qualified-human feature annotation.",
  );
  assert(annotatedCandidate.status === ANNOTATED_CANDIDATE_STATUS, "Annotated candidate status is invalid.");
  assert(annotatedCandidate.activationPolicy?.eligibleForActiveLesson === false, "Annotated candidate must remain ineligible for active lessons.");
  assert(annotatedCandidate.activationPolicy?.active === false, "Annotated candidate must remain inactive.");
  assert(!annotatedCandidate.activationPolicy?.blockers?.includes("item_level_feature_metadata_required"), "Annotated candidate must resolve the item-level feature metadata blocker.");
  assert(annotatedCandidate.activationPolicy?.blockers?.includes("controlled_manifest_review_required"), "Annotated candidate must retain controlled-manifest review blocker.");
  assert(annotatedCandidate.activationPolicy?.blockers?.includes("session_policy_rebuild_required"), "Annotated candidate must retain session-policy rebuild blocker.");
  return annotatedCandidate;
}


function controlledMetadataSnapshot(item) {
  return {
    allowedExerciseTypes: item.allowedExerciseTypes,
    focusMarksObserved: item.focusMarksObserved,
    articleClassObserved: item.articleClassObserved,
    materialShapeObserved: item.materialShapeObserved,
    hamzatWaslCandidate: item.hamzatWaslCandidate,
    targetFeatureConfirmed: item.targetFeatureConfirmed,
    stagePurityConfirmed: item.stagePurityConfirmed,
    metadataStatus: item.metadataStatus,
  };
}

function controlledMetadataSha256(item) {
  return sha256TextExact(JSON.stringify(controlledMetadataSnapshot(item)));
}

function assertSha256(value, label) {
  assert(/^[a-f0-9]{64}$/.test(value ?? ""), `${label} SHA-256 is required.`);
}

export function buildControlledManifestReviewTemplate(
  {
    annotatedCandidate,
    originalCandidate,
    featureAnnotation,
    registry,
  },
  {
    annotatedCandidateManifestSha256,
    candidateManifestSha256,
    featureAnnotationManifestSha256,
    evidenceRepoRoot = process.cwd(),
    candidateRepoRoot = process.cwd(),
    policyRepoRoot = process.cwd(),
  } = {},
) {
  assertSha256(annotatedCandidateManifestSha256, "Annotated candidate manifest");
  assertSha256(candidateManifestSha256, "Promoted candidate manifest");
  assertSha256(featureAnnotationManifestSha256, "Feature annotation manifest");

  validateAnnotatedCandidate(
    annotatedCandidate,
    originalCandidate,
    featureAnnotation,
    registry,
    {
      candidateManifestSha256,
      evidenceRepoRoot,
      candidateRepoRoot,
      policyRepoRoot,
    },
  );

  const moduleId = annotatedCandidate.verificationScope?.moduleId;
  const module = resolveModule(registry, moduleId);
  const items = annotatedCandidate.items;

  return {
    schemaVersion: "0.1",
    kind: CONTROLLED_MANIFEST_REVIEW_KIND,
    status: "pending_qualified_content_review",
    sourceControl: {
      canonicalSourceId: registry.sourceDocument.id,
      canonicalSourceSha256: registry.sourceDocument.sha256,
      moduleId: module.id,
      targetCategory: module.targetCategory,
    },
    inputs: {
      promotedCandidateSha256: candidateManifestSha256,
      featureAnnotationSha256: featureAnnotationManifestSha256,
      annotatedCandidateSha256: annotatedCandidateManifestSha256,
      featureAnnotationPolicySha256: annotatedCandidate.annotationControl.featureAnnotationPolicySha256,
      itemCount: items.length,
    },
    reviewPolicy: {
      authority: "qualified_content_reviewer",
      contentRewriteAllowed: false,
      activationAllowed: false,
      itemExclusionAllowed: false,
      everyItemDecisionRequired: true,
    },
    items: items.map((item) => ({
      id: item.id,
      sourcePdfPage: item.source.pdfPage,
      sourceOrder: item.source.sourceOrder,
      arabicUtf8Sha256: item.integrity.utf8Sha256,
      controlledMetadataSha256: controlledMetadataSha256(item),
      review: {
        exactBytesAndHashReviewed: null,
        evidenceBindingReviewed: null,
        featureMetadataReviewed: null,
        exerciseAuthorizationReviewed: null,
        stagePurityReviewed: null,
        decision: null,
        reviewedByQualifiedContentReviewer: false,
        notes: "",
      },
    })),
  };
}

export function validateControlledManifestReview(
  review,
  {
    annotatedCandidate,
    originalCandidate,
    featureAnnotation,
    registry,
  },
  {
    annotatedCandidateManifestSha256,
    candidateManifestSha256,
    featureAnnotationManifestSha256,
    evidenceRepoRoot = process.cwd(),
    candidateRepoRoot = process.cwd(),
    policyRepoRoot = process.cwd(),
  } = {},
) {
  assert(review && typeof review === "object", "Controlled-manifest review must be an object.");
  assert(review.schemaVersion === "0.1", "Unsupported controlled-manifest review schema.");
  assert(review.kind === CONTROLLED_MANIFEST_REVIEW_KIND, "Unexpected controlled-manifest review kind.");
  assert(
    review.status === "qualified_content_review_complete",
    "Controlled-manifest review must be explicitly marked complete.",
  );

  assertSha256(annotatedCandidateManifestSha256, "Annotated candidate manifest");
  assertSha256(candidateManifestSha256, "Promoted candidate manifest");
  assertSha256(featureAnnotationManifestSha256, "Feature annotation manifest");

  validateAnnotatedCandidate(
    annotatedCandidate,
    originalCandidate,
    featureAnnotation,
    registry,
    {
      candidateManifestSha256,
      evidenceRepoRoot,
      candidateRepoRoot,
      policyRepoRoot,
    },
  );

  const moduleId = annotatedCandidate.verificationScope?.moduleId;
  const module = resolveModule(registry, moduleId);
  const items = annotatedCandidate.items;

  assert(review.sourceControl?.canonicalSourceId === registry.sourceDocument.id, "Controlled-manifest review source id does not match the registry.");
  assert(review.sourceControl?.canonicalSourceSha256 === registry.sourceDocument.sha256, "Controlled-manifest review source SHA-256 does not match the registry.");
  assert(review.sourceControl?.moduleId === module.id, "Controlled-manifest review module does not match the annotated candidate.");
  assert(review.sourceControl?.targetCategory === module.targetCategory, "Controlled-manifest review target category does not match the annotated candidate.");

  assert(review.inputs?.promotedCandidateSha256 === candidateManifestSha256, "Controlled-manifest review promoted candidate SHA-256 drifted.");
  assert(review.inputs?.featureAnnotationSha256 === featureAnnotationManifestSha256, "Controlled-manifest review feature annotation SHA-256 drifted.");
  assert(review.inputs?.annotatedCandidateSha256 === annotatedCandidateManifestSha256, "Controlled-manifest review annotated candidate SHA-256 drifted.");
  assert(
    review.inputs?.featureAnnotationPolicySha256 === annotatedCandidate.annotationControl?.featureAnnotationPolicySha256,
    "Controlled-manifest review feature-annotation policy SHA-256 drifted.",
  );
  assert(review.inputs?.itemCount === items.length, "Controlled-manifest review item count does not match the annotated candidate.");

  assert(review.reviewPolicy?.authority === "qualified_content_reviewer", "Controlled-manifest review authority must be qualified_content_reviewer.");
  assert(review.reviewPolicy?.contentRewriteAllowed === false, "Controlled-manifest review must forbid content rewriting.");
  assert(review.reviewPolicy?.activationAllowed === false, "Controlled-manifest review must forbid activation.");
  assert(review.reviewPolicy?.itemExclusionAllowed === false, "Controlled-manifest review must forbid silent item exclusion.");
  assert(review.reviewPolicy?.everyItemDecisionRequired === true, "Controlled-manifest review must require every item decision.");

  assert(Array.isArray(review.items) && review.items.length === items.length, "Controlled-manifest review must cover every annotated item exactly once.");
  const itemById = new Map(items.map((item) => [item.id, item]));
  const seen = new Set();

  for (const [index, reviewItem] of review.items.entries()) {
    const label = `Controlled-manifest review item ${index + 1}`;
    assert(typeof reviewItem?.id === "string" && reviewItem.id.length > 0, `${label} id is missing.`);
    assert(!seen.has(reviewItem.id), `Controlled-manifest review contains duplicate item id ${reviewItem.id}.`);
    seen.add(reviewItem.id);

    const item = itemById.get(reviewItem.id);
    assert(item, `${label} does not exist in the annotated candidate: ${reviewItem.id}.`);
    assert(reviewItem.sourcePdfPage === item.source.pdfPage, `${label} source page drifted.`);
    assert(reviewItem.sourceOrder === item.source.sourceOrder, `${label} source order drifted.`);
    assert(reviewItem.arabicUtf8Sha256 === item.integrity.utf8Sha256, `${label} exact Arabic UTF-8 hash drifted.`);
    assert(reviewItem.controlledMetadataSha256 === controlledMetadataSha256(item), `${label} controlled metadata hash drifted.`);

    const decision = reviewItem.review;
    assert(decision && typeof decision === "object", `${label} decision is missing.`);
    assert(decision.exactBytesAndHashReviewed === true, `${label} exact bytes/hash were not explicitly reviewed.`);
    assert(decision.evidenceBindingReviewed === true, `${label} evidence binding was not explicitly reviewed.`);
    assert(decision.featureMetadataReviewed === true, `${label} feature metadata was not explicitly reviewed.`);
    assert(decision.exerciseAuthorizationReviewed === true, `${label} exercise authorization was not explicitly reviewed.`);
    assert(decision.stagePurityReviewed === true, `${label} stage purity was not explicitly reviewed.`);
    assert(decision.decision === "approve", `${label} is not explicitly approved for the controlled manifest.`);
    assert(decision.reviewedByQualifiedContentReviewer === true, `${label} is not marked reviewed by a qualified content reviewer.`);
    assert(typeof decision.notes === "string", `${label} notes must be a string.`);
  }

  for (const item of items) {
    assert(seen.has(item.id), `Controlled-manifest review is missing annotated item ${item.id}.`);
  }

  return { module, items };
}

export function applyControlledManifestReview(
  annotatedCandidate,
  review,
  {
    originalCandidate,
    featureAnnotation,
    registry,
  },
  options = {},
) {
  const { module, items } = validateControlledManifestReview(
    review,
    {
      annotatedCandidate,
      originalCandidate,
      featureAnnotation,
      registry,
    },
    options,
  );

  return {
    ...annotatedCandidate,
    status: REVIEWED_CANDIDATE_STATUS,
    controlledManifestReview: {
      schemaVersion: review.schemaVersion,
      kind: review.kind,
      authority: review.reviewPolicy.authority,
      promotedCandidateSha256: review.inputs.promotedCandidateSha256,
      featureAnnotationSha256: review.inputs.featureAnnotationSha256,
      annotatedCandidateSha256: review.inputs.annotatedCandidateSha256,
      featureAnnotationPolicySha256: review.inputs.featureAnnotationPolicySha256,
      everyItemApproved: true,
      contentRewriteApplied: false,
      activationApplied: false,
    },
    activationPolicy: {
      eligibleForActiveLesson: false,
      active: false,
      blockers: ["session_policy_rebuild_required"],
    },
    verificationScope: {
      ...annotatedCandidate.verificationScope,
      moduleId: module.id,
      targetCategory: module.targetCategory,
      controlledManifestReviewComplete: true,
    },
    items: items.map((item) => ({
      ...item,
      metadataStatus: "controlled_manifest_reviewed_pending_session_policy_rebuild",
      eligibleForActiveLesson: false,
      active: false,
    })),
  };
}

export function validateReviewedCandidate(
  reviewedCandidate,
  annotatedCandidate,
  review,
  {
    originalCandidate,
    featureAnnotation,
    registry,
  },
  options = {},
) {
  const expected = applyControlledManifestReview(
    annotatedCandidate,
    review,
    {
      originalCandidate,
      featureAnnotation,
      registry,
    },
    options,
  );
  assert(
    JSON.stringify(reviewedCandidate) === JSON.stringify(expected),
    "Reviewed candidate does not match deterministic application of the controlled-manifest review.",
  );
  assert(reviewedCandidate.status === REVIEWED_CANDIDATE_STATUS, "Reviewed candidate status is invalid.");
  assert(reviewedCandidate.activationPolicy?.eligibleForActiveLesson === false, "Reviewed candidate must remain ineligible for active lessons.");
  assert(reviewedCandidate.activationPolicy?.active === false, "Reviewed candidate must remain inactive.");
  assert(!reviewedCandidate.activationPolicy?.blockers?.includes("controlled_manifest_review_required"), "Reviewed candidate must resolve only the controlled-manifest review blocker.");
  assert(reviewedCandidate.activationPolicy?.blockers?.includes("session_policy_rebuild_required"), "Reviewed candidate must retain the session-policy rebuild blocker.");
  assert(reviewedCandidate.activationPolicy?.blockers?.length === 1, "Reviewed candidate must retain exactly the session-policy rebuild blocker.");
  assert(
    reviewedCandidate.items.every((item) =>
      item.metadataStatus === "controlled_manifest_reviewed_pending_session_policy_rebuild"
      && item.eligibleForActiveLesson === false
      && item.active === false
    ),
    "Reviewed candidate items must remain inactive and pending session-policy rebuild.",
  );
  return reviewedCandidate;
}

export function aggregatePromotedCandidates(
  candidates,
  registry,
  {
    evidenceRepoRoot = process.cwd(),
    candidateRepoRoot = process.cwd(),
    inputManifests = [],
  } = {},
) {
  assert(Array.isArray(candidates) && candidates.length > 0, "At least one promoted candidate is required for aggregation.");
  const validated = candidates.map((candidate) =>
    validatePromotedCandidate(candidate, registry, { evidenceRepoRoot, candidateRepoRoot }),
  );

  const module = validated[0].module;
  for (const entry of validated) {
    assert(entry.module.id === module.id, "All promoted subsets must belong to the same module.");
    assert(entry.module.targetCategory === module.targetCategory, "All promoted subsets must use the same target category.");
  }

  if (inputManifests.length > 0) {
    assert(inputManifests.length === candidates.length, "Input manifest provenance must cover every aggregated subset.");
  }
  const seenInputFiles = new Set();
  for (const [index, input] of inputManifests.entries()) {
    assert(typeof input?.file === "string" && input.file.length > 0, `Input manifest ${index + 1} file is missing.`);
    assert(/^[a-f0-9]{64}$/.test(input?.sha256 ?? ""), `Input manifest ${index + 1} SHA-256 is invalid.`);
    assert(!seenInputFiles.has(input.file), `Input manifest provenance contains duplicate file ${input.file}.`);
    seenInputFiles.add(input.file);
  }

  const items = [];
  const seenPositions = new Set();
  const seenIds = new Set();
  for (const entry of validated) {
    for (const item of entry.items) {
      const position = promotedSourcePosition(item, "Aggregated promoted item");
      assert(!seenPositions.has(position.key), `Aggregated promoted subsets overlap at source position ${position.key}.`);
      seenPositions.add(position.key);
      assert(!seenIds.has(item.id), `Aggregated promoted subsets contain duplicate item id ${item.id}.`);
      seenIds.add(item.id);
      items.push(item);
    }
  }

  items.sort((left, right) => {
    const a = promotedSourcePosition(left, "Aggregated promoted item");
    const b = promotedSourcePosition(right, "Aggregated promoted item");
    return a.page - b.page || a.order - b.order || left.id.localeCompare(right.id);
  });

  const registeredPositions = registeredCandidatePositions(module, registry, candidateRepoRoot);
  const registeredCandidateCoverageComplete =
    registeredPositions !== null &&
    seenPositions.size === registeredPositions.size &&
    [...registeredPositions].every((position) => seenPositions.has(position));

  return {
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
      coverage: "aggregated_source_subsets",
      candidateCountInModule: module.candidateCount,
      promotedItemCount: items.length,
      sourceSubsetCount: candidates.length,
      registeredCandidateCoverageComplete,
      sourcePositions: items.map((item) => ({
        sourcePdfPage: item.source.pdfPage,
        sourceOrder: item.source.sourceOrder,
      })),
    },
    aggregation: {
      strategy: "source_position_union",
      inputManifests,
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
    items,
  };
}

export function promoteVerification({ verification, evidenceMap, registry, repoRoot = process.cwd() }) {
  validateHumanVerificationBundle(verification, registry);
  const validatedEvidence = validateRepositoryEvidenceMap(evidenceMap, verification, registry, repoRoot);
  return buildControlledManifestCandidate(verification, registry, validatedEvidence);
}
