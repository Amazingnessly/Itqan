import assert from "node:assert/strict";
import { auditProgressiveSessionRebuildReadiness } from "./progressive-session-rebuild-readiness-lib.mjs";

const audit = auditProgressiveSessionRebuildReadiness();

assert.equal(audit.schemaVersion, "0.1");
assert.equal(audit.kind, "itqan-progressive-session-rebuild-readiness-audit");
assert.equal(audit.activationMutationAllowed, false);
assert.equal(audit.blueprintMutationAllowed, false);
assert.equal(audit.runtimeFingerprintMutationAllowed, false);
assert.ok(/^[a-f0-9]{64}$/.test(audit.sourceDocumentSha256));
assert.ok(/^[a-f0-9]{64}$/.test(audit.readinessPolicySha256));
assert.equal(audit.stages.length, 7, "Readiness audit must preserve the locked seven-stage path.");

const readingUnits = audit.stages.find((stage) => stage.id === "reading_units");
assert.ok(readingUnits);
assert.ok(readingUnits.blockers.some((blocker) => blocker.code === "reviewed_module_required"), "Current repository should not claim reading-units rebuild readiness before qualified review.");
assert.equal(readingUnits.rebuildReady, false);

const mixed = readingUnits.derivedPools.find((pool) => pool.id === "mixed_short_vowels");
assert.ok(mixed, "Readiness audit must model mixed_short_vowels as a derived reviewed pool.");
assert.equal(mixed.targetDistinctItems, 18);
assert.equal(mixed.minimumPerSourceModule, 6);
assert.equal(mixed.ready, false, "Current repository has no reviewed Fathah/Kasrah/Dammah pools yet.");

const qamariyyah = audit.stages.find((stage) => stage.id === "article_qamariyyah");
assert.ok(qamariyyah.blockers.some((blocker) => blocker.code === "verified_qamariyyah_source_pool_required" && blocker.issue === 235));
assert.equal(qamariyyah.rebuildReady, false);

const fluent = audit.stages.find((stage) => stage.id === "fluent_reading");
assert.ok(fluent.blockers.some((blocker) => blocker.code === "verified_fluent_reading_pool_required"));
assert.equal(audit.allStagesReady, false);
assert.equal(audit.readyStageCount, 0, "No progressive stage should currently claim rebuild readiness before reviewed artifacts exist.");

console.log("Progressive session-rebuild readiness audit passed against current repository state.");
