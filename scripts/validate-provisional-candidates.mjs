import fs from "node:fs";

const registry = JSON.parse(fs.readFileSync("public/content/source-intake/progressive-support.json", "utf8"));
const registered = (registry.modules ?? []).filter((entry) => entry.candidateBundle);

if (registered.length < 3) {
  throw new Error("Expected provisional candidate bundles for Fathah, Kasrah and Dammah.");
}

const prohibitedLaterMarks = /[\u064B-\u064D\u0651\u0652]/u;
const expectedCounts = new Map([
  ["fathah", 60],
  ["kasrah", 20],
  ["dammah", 20],
  ["madd_alif", 24],
]);

for (const module of registered) {
  if (module.candidateStatus !== "provisional_non_authoritative_pending_human_verification") {
    throw new Error(`${module.id} candidate bundle must remain explicitly non-authoritative.`);
  }
  if (!Number.isInteger(module.candidateCount) || module.candidateCount < 1) {
    throw new Error(`${module.id} candidate count must be explicit.`);
  }

  const bundlePath = "public" + module.candidateBundle;
  if (!fs.existsSync(bundlePath)) throw new Error(`Missing candidate bundle for ${module.id}.`);
  const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

  if (bundle.kind !== "itqan-progressive-provisional-transcription") {
    throw new Error(`Unexpected provisional candidate bundle kind for ${module.id}.`);
  }
  if (bundle.authoritative !== false || bundle.humanVerificationRequired !== true) {
    throw new Error(`${module.id} candidates must require human verification and remain non-authoritative.`);
  }
  if (bundle.normalizationApplied !== false) {
    throw new Error(`${module.id} candidate generation must not normalize Arabic.`);
  }
  if (bundle.sourceDocumentId !== registry.sourceDocument.id) {
    throw new Error(`${module.id} candidate source document does not match the canonical registry.`);
  }
  if (bundle.moduleId !== module.id) {
    throw new Error(`${module.id} candidate bundle must declare its module.`);
  }
  if (!Array.isArray(bundle.items) || bundle.items.length !== module.candidateCount) {
    throw new Error(`${module.id} candidate count does not match the registered count.`);
  }
  const expectedCount = expectedCounts.get(module.id);
  if (expectedCount && bundle.items.length !== expectedCount) {
    throw new Error(`${module.id} expected ${expectedCount} provisional candidates.`);
  }

  for (const [index, item] of bundle.items.entries()) {
    if (item.moduleId !== module.id) throw new Error(`${module.id} candidate ${index + 1} escaped its module.`);
    if (!module.sourcePdfPages.includes(item.sourcePdfPage)) {
      throw new Error(`${module.id} candidate ${index + 1} uses an unexpected source page.`);
    }
    if (!Number.isInteger(item.sourceOrder) || item.sourceOrder < 1) {
      throw new Error(`${module.id} candidate ${index + 1} has invalid source order.`);
    }
    if (typeof item.arabicCandidate !== "string" || item.arabicCandidate.length === 0) {
      throw new Error(`${module.id} candidate ${index + 1} is empty.`);
    }
    if (/\s/u.test(item.arabicCandidate)) {
      throw new Error(`${module.id} candidate ${index + 1} must remain an isolated word.`);
    }
    if (module.targetCategory === "reading_units" && prohibitedLaterMarks.test(item.arabicCandidate)) {
      throw new Error(`${module.id} candidate ${index + 1} leaks a later combining mark into reading_units.`);
    }
  }
}

const fathah = registered.find((entry) => entry.id === "fathah");
const fathahBundle = JSON.parse(fs.readFileSync("public" + fathah.candidateBundle, "utf8"));
const page24 = fathahBundle.items.filter((item) => item.sourcePdfPage === 24);
const page25 = fathahBundle.items.filter((item) => item.sourcePdfPage === 25);
if (page24.length !== 40 || page25.length !== 20) {
  throw new Error("Fathah source coverage must remain 40 candidates on page 24 and 20 on page 25.");
}

const kasrah = registered.find((entry) => entry.id === "kasrah");
const kasrahBundle = JSON.parse(fs.readFileSync("public" + kasrah.candidateBundle, "utf8"));
if (!kasrahBundle.items.every((item) => item.sourcePdfPage === 26)) {
  throw new Error("Kasrah wave 1 must remain scoped to page 26.");
}

const dammah = registered.find((entry) => entry.id === "dammah");
const dammahBundle = JSON.parse(fs.readFileSync("public" + dammah.candidateBundle, "utf8"));
if (!dammahBundle.items.every((item) => item.sourcePdfPage === 30)) {
  throw new Error("Dammah wave 1 must remain scoped to page 30 Tadrib 2.");
}

const maddAlif = registered.find((entry) => entry.id === "madd_alif");
const maddAlifBundle = JSON.parse(fs.readFileSync("public" + maddAlif.candidateBundle, "utf8"));
if (!maddAlifBundle.items.every((item) => item.sourcePdfPage === 34)) {
  throw new Error("Madd Alif wave 1 must remain scoped to page 34 Tadrib 1.");
}

console.log("OK: registered provisional candidate bundles are source-scoped, isolated, non-authoritative, and gated by human verification.");
