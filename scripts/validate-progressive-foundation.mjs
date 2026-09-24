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
];

if (plan.schemaVersion !== "0.1") throw new Error("Unsupported progressive foundation schema.");
if (plan.category !== "reading_units") throw new Error("Progressive foundation must stay inside reading_units.");
if (!Array.isArray(plan.steps) || JSON.stringify(plan.steps.map((step) => step.id)) !== JSON.stringify(expected)) {
  throw new Error("Progressive foundation order must be Fathah -> Kasrah -> Dammah -> mixed short vowels -> madd Alif -> madd Ya.");
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
const twoWords = plan.deferredMaterial?.find((entry) => entry.id === "two_words");
if (!twoWords || twoWords.targetCategory !== "linking" || twoWords.materialShape !== "two_words" || twoWords.activation !== "deferred_until_linking_stage") {
  throw new Error("Two-word material must remain deferred to linking.");
}
if (!String(plan.activationRule ?? "").includes("double-visually-verified")) {
  throw new Error("Progressive foundation activation must require double visual verification.");
}
console.log("OK: progressive foundation curriculum order and stage-purity contract passed.");
