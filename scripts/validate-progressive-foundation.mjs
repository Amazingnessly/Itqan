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
for (const required of ["madd_waw", "mixed_madd", "tanwin_damm", "sukun"]) {
  const entry = intake.get(required);
  if (!entry || entry.status !== "visual_source_received") {
    throw new Error(`Progressive source intake must record received module: ${required}.`);
  }
}
if (intake.get("tanwin_damm")?.placement !== "vowels_sukun" || intake.get("tanwin_damm")?.sequenceAfter !== "mixed_madd") {
  throw new Error("Tanwin Damm must follow mixed madd inside vowels_sukun.");
}
if (intake.get("sukun")?.placement !== "vowels_sukun" || intake.get("sukun")?.sequenceAfter !== "tanwin_damm") {
  throw new Error("Sukun must follow Tanwin Damm inside vowels_sukun.");
}

const twoWords = plan.deferredMaterial?.find((entry) => entry.id === "two_words");
if (!twoWords || twoWords.targetCategory !== "linking" || twoWords.materialShape !== "two_words" || twoWords.activation !== "deferred_until_linking_stage") {
  throw new Error("Two-word material must remain deferred to linking.");
}
if (!String(plan.activationRule ?? "").includes("double-visually-verified")) {
  throw new Error("Progressive foundation activation must require double visual verification.");
}
console.log("OK: progressive foundation curriculum order and stage-purity contract passed.");
