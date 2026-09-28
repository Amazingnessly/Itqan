import assert from "node:assert/strict";
import fs from "node:fs";
import {
  evaluateSessionRebuildReadiness,
  validateSessionRebuildReadinessPolicy,
} from "./progressive-session-rebuild-readiness-lib.mjs";

const registry = JSON.parse(fs.readFileSync("public/content/source-intake/progressive-support.json", "utf8"));
const policy = JSON.parse(fs.readFileSync("public/content/source-intake/session-rebuild-readiness-policy.json", "utf8"));
validateSessionRebuildReadinessPolicy(policy, registry);

const moduleIds = registry.modules.filter((module) => module.candidateBundle).map((module) => module.id);
const richInventory = new Map(moduleIds.map((moduleId) => [
  moduleId,
  {
    reviewed: true,
    itemIds: Array.from({ length: 24 }, (_, index) => `${moduleId}-reviewed-${index + 1}`),
    currentStage: "reviewed_pending_session_policy_rebuild",
    nextRequiredArtifact: "session_policy_rebuild",
  },
]));

const rich = evaluateSessionRebuildReadiness(policy, richInventory);
const readingUnits = rich.stages.find((stage) => stage.id === "reading_units");
assert.equal(readingUnits.corpusReady, true, "Reading-units corpus should become ready when all reviewed pools satisfy the policy.");
assert.equal(readingUnits.prerequisitesReady, true);
assert.equal(readingUnits.rebuildReady, true);
const mixed = readingUnits.derivedPools.find((pool) => pool.id === "mixed_short_vowels");
assert.equal(mixed.ready, true, "Mixed short vowels must be derived from reviewed Fathah/Kasrah/Dammah pools.");
assert.equal(mixed.sourceCounts.fathah, 24);
assert.equal(mixed.sourceCounts.kasrah, 24);
assert.equal(mixed.sourceCounts.dammah, 24);
assert.ok(mixed.availableDistinctItemCount >= 18);

const vowels = rich.stages.find((stage) => stage.id === "vowels_sukun");
assert.equal(vowels.rebuildReady, true, "Vowels/Sukun may become rebuild-ready after reading_units and reviewed source pools.");

const qamariyyah = rich.stages.find((stage) => stage.id === "article_qamariyyah");
assert.equal(qamariyyah.corpusReady, false, "Qamariyyah must remain blocked by the explicit verified-source gap.");
assert.equal(qamariyyah.rebuildReady, false);
assert.ok(qamariyyah.blockers.some((blocker) => blocker.code === "verified_qamariyyah_source_pool_required" && blocker.issue === 235));

const shaddah = rich.stages.find((stage) => stage.id === "shaddah");
assert.equal(shaddah.corpusReady, true, "A reviewed Shaddah pool may be corpus-ready independently.");
assert.equal(shaddah.prerequisitesReady, false, "Shaddah rebuild readiness must still respect the locked qamariyyah-before-shaddah learner order.");
assert.equal(shaddah.rebuildReady, false);

const shamsiyyah = rich.stages.find((stage) => stage.id === "article_shamsiyyah");
assert.equal(shamsiyyah.corpusReady, true, "A reviewed shamsiyyah pool may be corpus-ready independently.");
assert.equal(shamsiyyah.rebuildReady, false, "Shamsiyyah cannot bypass the blocked prerequisite chain.");

const fluent = rich.stages.find((stage) => stage.id === "fluent_reading");
assert.equal(fluent.corpusReady, false, "Fluent reading must require a separately verified controlled pool.");
assert.ok(fluent.blockers.some((blocker) => blocker.code === "verified_fluent_reading_pool_required"));

const insufficientInventory = new Map(richInventory);
insufficientInventory.set("kasrah", {
  reviewed: true,
  itemIds: Array.from({ length: 5 }, (_, index) => `kasrah-reviewed-${index + 1}`),
  currentStage: "reviewed_pending_session_policy_rebuild",
  nextRequiredArtifact: "session_policy_rebuild",
});
const insufficient = evaluateSessionRebuildReadiness(policy, insufficientInventory);
const insufficientReading = insufficient.stages.find((stage) => stage.id === "reading_units");
const insufficientMixed = insufficientReading.derivedPools.find((pool) => pool.id === "mixed_short_vowels");
assert.equal(insufficientMixed.ready, false, "Mixed short vowels must require at least six reviewed items from each source module.");
assert.equal(insufficientMixed.sourceCounts.kasrah, 5);
assert.ok(insufficientReading.blockers.some((blocker) => blocker.code === "derived_reviewed_pool_insufficient"));

const missingModuleInventory = new Map(richInventory);
missingModuleInventory.set("sukun", {
  reviewed: false,
  itemIds: [],
  currentStage: "candidate_ready_for_human_verification",
  nextRequiredArtifact: "qualified_human_verification_and_repository_evidence",
});
const missing = evaluateSessionRebuildReadiness(policy, missingModuleInventory);
const missingVowels = missing.stages.find((stage) => stage.id === "vowels_sukun");
assert.equal(missingVowels.corpusReady, false);
assert.ok(missingVowels.blockers.some((blocker) =>
  blocker.code === "reviewed_module_required"
  && blocker.moduleId === "sukun"
  && blocker.nextRequiredArtifact === "qualified_human_verification_and_repository_evidence"
));

console.log("Progressive session-rebuild readiness policy contract passed.");
