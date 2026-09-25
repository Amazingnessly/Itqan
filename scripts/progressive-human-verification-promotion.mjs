import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_REGISTRY_PATH = "public/content/source-intake/progressive-support.json";
const SAFE_OUTPUT_ROOT = path.resolve("public/content/verified-candidates");

function sha256Utf8(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function validateHumanVerificationBundle({ bundle, registry, requireRepositoryEvidence = true }) {
  const errors = [];

  if (bundle?.schemaVersion !== "0.2") errors.push("unsupported verification bundle schema");
  if (bundle?.kind !== "itqan-progressive-human-verification") errors.push("unexpected verification bundle kind");
  if (bundle?.humanVerificationAuthority !== true) errors.push("humanVerificationAuthority must be true");
  if (bundle?.candidateTranscriptionAuthoritative !== false) errors.push("candidateTranscriptionAuthoritative must be false");
  if (bundle?.normalizationApplied !== false) errors.push("bundle normalizationApplied must be false");

  const moduleId = bundle?.verificationScope?.moduleId;
  const module = (registry?.modules ?? []).find((entry) => entry.id === moduleId);
  if (!module) errors.push("verification scope references an unknown module");
  if (module && bundle?.verificationScope?.targetCategory !== module.targetCategory) {
    errors.push("verification scope category does not match source registry");
  }

  if (bundle?.sourceDocument?.id !== registry?.sourceDocument?.id) {
    errors.push("source document id does not match canonical registry");
  }
  if (bundle?.sourceDocument?.sha256 !== registry?.sourceDocument?.sha256) {
    errors.push("source document SHA-256 does not match canonical registry");
  }

  if (!Array.isArray(bundle?.items) || bundle.items.length === 0) {
    errors.push("verification bundle has no items");
  }

  const positions = new Set();
  for (const [index, item] of (bundle?.items ?? []).entries()) {
    const prefix = `item ${index + 1}`;
    if (item?.moduleId !== moduleId) errors.push(`${prefix}: moduleId escaped verification scope`);
    if (!module?.sourcePdfPages?.includes(item?.sourcePdfPage)) {
      errors.push(`${prefix}: source page is not authorized for module`);
    }
    if (!Number.isInteger(item?.sourceOrder) || item.sourceOrder < 1) {
      errors.push(`${prefix}: invalid sourceOrder`);
    }
    const positionKey = `${item?.sourcePdfPage}:${item?.sourceOrder}`;
    if (positions.has(positionKey)) errors.push(`${prefix}: duplicate source page/order`);
    positions.add(positionKey);

    if (typeof item?.arabicExact !== "string" || item.arabicExact.length === 0) {
      errors.push(`${prefix}: missing exact Arabic`);
    } else if (sha256Utf8(item.arabicExact) !== item?.integrity?.utf8Sha256) {
      errors.push(`${prefix}: exact UTF-8 checksum mismatch`);
    }
    if (item?.integrity?.normalizationApplied !== false) {
      errors.push(`${prefix}: normalizationApplied must be false`);
    }
    if (item?.verification?.visualPass1 !== true) errors.push(`${prefix}: visualPass1 must be true`);
    if (item?.verification?.visualPass2 !== true) errors.push(`${prefix}: visualPass2 must be true`);
    if (item?.verification?.reviewedAmbiguity !== true) errors.push(`${prefix}: ambiguity must be explicitly reviewed`);
    if (item?.verification?.ambiguous !== false) errors.push(`${prefix}: ambiguous must be false`);
    if (item?.verification?.humanVerified !== true) errors.push(`${prefix}: humanVerified must be true`);
  }

  if (requireRepositoryEvidence) {
    const source = registry?.sourceDocument;
    if (source?.repositoryBacked !== true) {
      errors.push("canonical source evidence is not repository-backed");
    }
    if (typeof source?.repositoryPath !== "string" || !source.repositoryPath.length) {
      errors.push("canonical source repositoryPath is missing");
    } else {
      const evidencePath = path.resolve(source.repositoryPath);
      if (!fs.existsSync(evidencePath)) {
        errors.push("canonical source repositoryPath does not resolve");
      } else if (source?.sha256 && sha256File(evidencePath) !== source.sha256) {
        errors.push("repository-backed source SHA-256 does not match canonical registry");
      }
    }
  }

  if (errors.length) {
    throw new Error(errors.join("; "));
  }

  return { module, moduleId };
}

function safeTag(value) {
  return String(value).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function buildControlledManifestCandidate({ bundle, registry }) {
  const moduleId = bundle.verificationScope.moduleId;
  const module = registry.modules.find((entry) => entry.id === moduleId);
  if (!module) throw new Error("unknown module");

  const sortedItems = [...bundle.items].sort(
    (a, b) => a.sourcePdfPage - b.sourcePdfPage || a.sourceOrder - b.sourceOrder,
  );

  const ids = new Set();
  const items = sortedItems.map((item) => {
    const id = `ITQAN-PROG-${safeTag(moduleId)}-P${String(item.sourcePdfPage).padStart(3, "0")}-${String(item.sourceOrder).padStart(3, "0")}`;
    if (ids.has(id)) throw new Error(`duplicate deterministic id: ${id}`);
    ids.add(id);

    return {
      id,
      source: {
        sourceId: registry.sourceDocument.id,
        file: registry.sourceDocument.uploadedFilename,
        repositoryPath: registry.sourceDocument.repositoryPath,
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
        visualPass2Method: "qualified_human_against_canonical_pdf_second_pass",
        evidence: {
          sourceFile: registry.sourceDocument.repositoryPath,
          pdfPage: item.sourcePdfPage,
        },
        ambiguous: false,
        humanVerified: true,
      },
      substage: moduleId,
      allowedExerciseTypes: [module.targetCategory],
      focusMarksObserved: [],
      articleClassObserved: [],
      contentFeatureMetadataStatus: "pending_source_supported_classification",
      audio: {
        sourceAudioPresent: false,
        referenceAudioStatus: "to-record-or-generate-and-validate",
      },
      eligibleForActiveLesson: false,
      active: false,
      promotionStatus: "human_verified_evidence_backed_metadata_pending",
    };
  });

  const verifiedPdfPages = [...new Set(sortedItems.map((item) => item.sourcePdfPage))].sort((a, b) => a - b);
  const verificationDigest = crypto
    .createHash("sha256")
    .update(JSON.stringify(sortedItems.map((item) => ({
      p: item.sourcePdfPage,
      o: item.sourceOrder,
      h: item.integrity.utf8Sha256,
    }))))
    .digest("hex");

  return {
    schemaVersion: "0.1",
    project: "Itqān",
    batchId: `ITQAN-PROG-${safeTag(moduleId)}-${verificationDigest.slice(0, 12).toUpperCase()}`,
    status: "human_verified_candidate_not_activated",
    sourceControl: {
      canonicalSourceId: registry.sourceDocument.id,
      canonicalFile: registry.sourceDocument.uploadedFilename,
      repositoryEvidencePath: registry.sourceDocument.repositoryPath,
      verifiedPdfPages,
      visualPassesPerItem: 2,
      silentNormalization: false,
      machineTranscriptionUsedAsAuthority: false,
      humanVerificationAuthority: true,
    },
    module: {
      id: moduleId,
      targetCategory: module.targetCategory,
    },
    items,
  };
}

export function promoteHumanVerification({ bundle, registry }) {
  validateHumanVerificationBundle({ bundle, registry, requireRepositoryEvidence: true });
  return buildControlledManifestCandidate({ bundle, registry });
}

function assertSafeOutputPath(outputPath) {
  const resolved = path.resolve(outputPath);
  const relative = path.relative(SAFE_OUTPUT_ROOT, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("output must be inside public/content/verified-candidates/");
  }
  return resolved;
}

async function main() {
  const [, , verificationPath, outputPath, registryPath = DEFAULT_REGISTRY_PATH] = process.argv;
  if (!verificationPath || !outputPath) {
    console.error("Usage: node scripts/progressive-human-verification-promotion.mjs <verification.json> <public/content/verified-candidates/output.json> [registry.json]");
    process.exit(2);
  }

  const bundle = loadJson(verificationPath);
  const registry = loadJson(registryPath);
  const output = promoteHumanVerification({ bundle, registry });
  const safeOutput = assertSafeOutputPath(outputPath);
  fs.mkdirSync(path.dirname(safeOutput), { recursive: true });
  fs.writeFileSync(safeOutput, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(`Wrote inactive controlled-manifest candidate: ${path.relative(process.cwd(), safeOutput)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
