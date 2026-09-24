import fs from "node:fs";

const registry = JSON.parse(fs.readFileSync("public/content/source-intake/progressive-support.json", "utf8"));
const module = registry.modules.find((entry) => entry.id === "fathah");
if (!module?.candidateBundle) throw new Error("Fathah candidate bundle is not registered.");
if (module.candidateStatus !== "provisional_non_authoritative_pending_human_verification") {
  throw new Error("Fathah candidate bundle must remain explicitly non-authoritative.");
}

const bundlePath = "public" + module.candidateBundle;
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

if (bundle.kind !== "itqan-progressive-provisional-transcription") {
  throw new Error("Unexpected provisional candidate bundle kind.");
}
if (bundle.authoritative !== false || bundle.humanVerificationRequired !== true) {
  throw new Error("Provisional candidates must require human verification and remain non-authoritative.");
}
if (bundle.normalizationApplied !== false) {
  throw new Error("Provisional candidate generation must not normalize Arabic.");
}
if (bundle.sourceDocumentId !== registry.sourceDocument.id) {
  throw new Error("Candidate source document does not match the canonical registry.");
}
if (!Array.isArray(bundle.items) || bundle.items.length !== module.candidateCount || bundle.items.length !== 60) {
  throw new Error("Fathah wave 1 must contain exactly 60 provisional word candidates.");
}

const prohibitedMarks = /[\u064B-\u064D\u0651\u0652]/u;
for (const [index, item] of bundle.items.entries()) {
  if (item.moduleId !== "fathah") throw new Error(`Candidate ${index + 1} escaped the fathah module.`);
  if (![24, 25].includes(item.sourcePdfPage)) throw new Error(`Candidate ${index + 1} uses an unexpected source page.`);
  if (!Number.isInteger(item.sourceOrder) || item.sourceOrder < 1) throw new Error(`Candidate ${index + 1} has invalid source order.`);
  if (typeof item.arabicCandidate !== "string" || item.arabicCandidate.length === 0) throw new Error(`Candidate ${index + 1} is empty.`);
  if (/\s/u.test(item.arabicCandidate)) throw new Error(`Candidate ${index + 1} must remain an isolated word.`);
  if (prohibitedMarks.test(item.arabicCandidate)) throw new Error(`Candidate ${index + 1} leaks a later combining mark into the fathah wave.`);
}

const page24 = bundle.items.filter((item) => item.sourcePdfPage === 24);
const page25 = bundle.items.filter((item) => item.sourcePdfPage === 25);
if (page24.length !== 40 || page25.length !== 20) {
  throw new Error("Fathah source coverage must remain 40 candidates on page 24 and 20 on page 25.");
}

console.log("OK: fathah provisional candidates are source-scoped, isolated, non-authoritative, and gated by human verification.");
