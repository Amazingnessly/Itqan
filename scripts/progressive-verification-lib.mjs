import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const VERIFICATION_KIND = "itqan-progressive-human-verification";
export const EVIDENCE_KIND = "itqan-progressive-repository-evidence-map";
export const PROMOTED_KIND = "itqan-progressive-controlled-manifest-candidate";

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

export function promoteVerification({ verification, evidenceMap, registry, repoRoot = process.cwd() }) {
  validateHumanVerificationBundle(verification, registry);
  const validatedEvidence = validateRepositoryEvidenceMap(evidenceMap, verification, registry, repoRoot);
  return buildControlledManifestCandidate(verification, registry, validatedEvidence);
}
