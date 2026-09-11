import fs from "node:fs";

const targetFiles = [
  "public/content/blueprints/reading_units-batch02.json",
  "public/content/blueprints/vowels_sukun-batch02.json",
  "public/content/blueprints/shaddah-batch02.json",
  "public/content/blueprints/article_al-batch02.json",
  "public/content/blueprints/linking-batch02.json",
];

let changed = 0;
for (const file of targetFiles) {
  const blueprint = JSON.parse(fs.readFileSync(file, "utf8"));
  const policy = blueprint.unlockPolicy;
  if (
    policy?.singleSessionCompletionIsMastery !== false ||
    policy?.requiresMultipleContexts !== true ||
    policy?.requiresDelayedCheck !== true ||
    policy?.speedCanNeverCompensateForErrors !== true
  ) {
    throw new Error(`Refusing to patch unsafe mastery policy in ${file}.`);
  }
  if (policy.timingOnlyAfterPrecisionStability === true) continue;
  if (policy.timingOnlyAfterPrecisionStability !== false) {
    throw new Error(`Unexpected timing policy shape in ${file}.`);
  }
  policy.timingOnlyAfterPrecisionStability = true;
  fs.writeFileSync(file, JSON.stringify(blueprint, null, 2) + "\n", "utf8");
  changed += 1;
}

if (changed !== 0 && changed !== targetFiles.length) {
  throw new Error(`Unexpected partial timing-policy migration: ${changed}/${targetFiles.length}.`);
}
console.log(`OK: ${changed || targetFiles.length} controlled blueprints satisfy precision-before-timing policy.`);
