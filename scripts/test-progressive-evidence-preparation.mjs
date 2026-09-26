import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  EVIDENCE_KIND,
  VERIFICATION_KIND,
  buildRepositoryEvidenceMapFromVerification,
  buildRepositoryEvidenceWorklist,
  readJson,
  sha256TextExact,
  validateRepositoryEvidenceMap,
} from "./progressive-verification-lib.mjs";

const registry = readJson("public/content/source-intake/progressive-support.json");
const module = registry.modules.find((entry) => entry.id === "sukun");
assert.ok(module?.candidateBundle, "Sukun must expose a registered provisional candidate bundle.");
const candidates = readJson("public" + module.candidateBundle);
const selected = candidates.items.slice(0, 3);
assert.equal(selected.length, 3);

const items = selected.map((candidate) => {
  const exact = `evidence-sample-${candidate.sourcePdfPage}-${candidate.sourceOrder}`;
  return {
    moduleId: module.id,
    sourcePdfPage: candidate.sourcePdfPage,
    sourceOrder: candidate.sourceOrder,
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

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "itqan-progressive-evidence-"));
try {
  const candidateRelative = module.candidateBundle.startsWith("/content/")
    ? `public${module.candidateBundle}`
    : module.candidateBundle.replace(/^\\/+/, "");
  const candidateDestination = path.join(tempRoot, candidateRelative);
  fs.mkdirSync(path.dirname(candidateDestination), { recursive: true });
  fs.copyFileSync(path.resolve(candidateRelative), candidateDestination);

  const worklist = buildRepositoryEvidenceWorklist([verification], registry, {
    candidateRepoRoot: tempRoot,
    evidenceRepoRoot: tempRoot,
  });
  assert.equal(worklist.kind, "itqan-progressive-repository-evidence-worklist");
  assert.equal(worklist.moduleId, "sukun");
  assert.equal(worklist.verifiedItemCount, 3);
  assert.equal(worklist.registeredCandidateCoverageComplete, false);
  assert.equal(worklist.items.length, 3);
  assert.ok(
    worklist.items.every((item) =>
      item.evidence.full.startsWith("public/content/evidence/progressive/sukun/") &&
      item.evidence.crop.startsWith("public/content/evidence/progressive/sukun/"),
    ),
    "Evidence worklist paths must remain deterministic and module-scoped.",
  );

  const fullFiles = worklist.requiredFiles.filter((file) => file.role === "full_page");
  const cropFiles = worklist.requiredFiles.filter((file) => file.role === "item_crop");
  assert.equal(fullFiles.length, new Set(selected.map((item) => item.sourcePdfPage)).size);
  assert.equal(cropFiles.length, 3);

  for (const required of worklist.requiredFiles) {
    const absolute = path.join(tempRoot, required.path);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    const payload = required.role === "full_page"
      ? `full-page-${required.sourcePdfPage}`
      : `crop-${required.sourcePdfPage}-${required.sourceOrder}`;
    fs.writeFileSync(absolute, payload, "utf8");
  }

  const evidenceMap = buildRepositoryEvidenceMapFromVerification(
    verification,
    registry,
    tempRoot,
  );
  assert.equal(evidenceMap.kind, EVIDENCE_KIND);
  assert.equal(evidenceMap.items.length, 3);
  assert.equal(evidenceMap.verificationScope.itemCount, 3);
  assert.equal(evidenceMap.verificationScope.partIndex, 1);
  assert.equal(evidenceMap.evidenceRoot, "public/content/evidence/progressive");
  assert.equal(validateRepositoryEvidenceMap(evidenceMap, verification, registry, tempRoot).length, 3);

  const badScope = structuredClone(evidenceMap);
  badScope.verificationScope.partIndex = 999;
  assert.throws(
    () => validateRepositoryEvidenceMap(badScope, verification, registry, tempRoot),
    /part index/,
    "Evidence-map subset provenance must stay bound to the verification artifact.",
  );

  const missingCrop = path.join(tempRoot, evidenceMap.items[0].evidence.crop);
  fs.rmSync(missingCrop);
  assert.throws(
    () => buildRepositoryEvidenceMapFromVerification(verification, registry, tempRoot),
    /does not exist/,
    "Evidence-map construction must fail until every required repository file exists.",
  );

  assert.throws(
    () =>
      buildRepositoryEvidenceWorklist([verification], registry, {
        candidateRepoRoot: tempRoot,
        evidenceRepoRoot: tempRoot,
        evidenceRoot: "public/content/evidence/../outside",
      }),
    /traverse/,
    "Evidence worklist root must not escape the repository evidence area.",
  );

  console.log("Progressive repository evidence preparation contract passed.");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
