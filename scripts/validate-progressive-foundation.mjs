import fs from "node:fs";

const path = "public/content/curriculum/progressive-foundation.json";
const plan = JSON.parse(fs.readFileSync(path, "utf8"));
const arabicPattern = /[\u0600-\u06ff]/u;

const expected = [
  "fathah",
  "kasrah",
  "dammah",
  "mixed_short_vowels",
  "madd_alif",
  "madd_ya",
  "madd_waw",
  "mixed_madd",
];

if (plan.schemaVersion !== "0.1") throw new Error("Unsupported progressive foundation schema.");
if (plan.category !== "reading_units") throw new Error("Progressive foundation must stay inside reading_units.");
if (!Array.isArray(plan.steps) || JSON.stringify(plan.steps.map((step) => step.id)) !== JSON.stringify(expected)) {
  throw new Error("Progressive foundation order must be Fathah -> Kasrah -> Dammah -> mixed short vowels -> madd Alif -> madd Ya -> madd Waw -> mixed madd consolidation.");
}
if (arabicPattern.test(JSON.stringify(plan))) {
  throw new Error("Progressive foundation plan must not embed Arabic exercise content.");
}
for (const step of plan.steps) {
  if (step.materialShape !== "isolated_word") throw new Error(`${step.id} must use isolated words.`);
  const forbidden = new Set(step.forbiddenFeatures ?? []);
  for (const feature of ["sukun", "shaddah", "article", "multi_word"]) {
    if (!forbidden.has(feature)) throw new Error(`${step.id} must forbid ${feature}.`);
  }
}

const intake = new Map((plan.sourceIntakeModules ?? []).map((entry) => [entry.id, entry]));
for (const required of [
  "fathah",
  "kasrah",
  "dammah",
  "mixed_short_vowels",
  "madd_alif",
  "madd_ya",
  "madd_waw",
  "mixed_madd",
  "tanwin_fath",
  "tanwin_kasr",
  "tanwin_damm",
  "tanwin_mixed",
  "sukun",
  "shaddah_source_block",
]) {
  const entry = intake.get(required);
  if (!entry || entry.status !== "canonical_pdf_received") {
    throw new Error(`Canonical progressive source intake must record received module: ${required}.`);
  }
}

const sequence = [
  ["tanwin_fath", "mixed_madd"],
  ["tanwin_kasr", "tanwin_fath"],
  ["tanwin_damm", "tanwin_kasr"],
  ["tanwin_mixed", "tanwin_damm"],
  ["sukun", "tanwin_mixed"],
];
for (const [id, previous] of sequence) {
  const entry = intake.get(id);
  if (entry?.placement !== "vowels_sukun" || entry?.sequenceAfter !== previous) {
    throw new Error(`${id} must follow ${previous} inside vowels_sukun.`);
  }
}

const substages = plan.vowelsSukunSubstages?.map((entry) => entry.id) ?? [];
if (JSON.stringify(substages.slice(0, 5)) !== JSON.stringify(["tanwin_fath","tanwin_kasr","tanwin_damm","tanwin_mixed","sukun"])) {
  throw new Error("vowels_sukun must preserve the source-led Tanwin -> Sukun sequence.");
}

const twoWords = plan.deferredMaterial?.find((entry) => entry.id === "two_words");
if (!twoWords || twoWords.targetCategory !== "linking" || twoWords.materialShape !== "two_words" || twoWords.activation !== "deferred_until_linking_stage") {
  throw new Error("Two-word material must remain deferred to linking.");
}
if (!String(plan.activationRule ?? "").includes("double-visually-verified")) {
  throw new Error("Progressive foundation activation must require double visual verification.");
}
if (plan.controlledTranscriptionGate?.status !== "candidate_transcription_requires_human_verification") {
  throw new Error("Candidate transcription must remain gated by human verification.");
}
if (plan.controlledTranscriptionGate?.humanTypingRequired !== false) {
  throw new Error("Human verification must not require retyping as the default workflow.");
}
console.log("OK: progressive foundation and verification-first canonical-source contract passed.");
