import assert from "node:assert/strict";
import { auditProgressivePipelineState } from "./progressive-pipeline-audit-lib.mjs";

const audit = auditProgressivePipelineState();

assert.equal(audit.schemaVersion, "0.1");
assert.equal(audit.kind, "itqan-progressive-pipeline-state-audit");
assert.ok(/^[a-f0-9]{64}$/.test(audit.sourceDocumentSha256), "Pipeline audit must report the canonical source SHA-256.");
assert.ok(/^[a-f0-9]{64}$/.test(audit.featureAnnotationPolicySha256), "Pipeline audit must bind the current feature-annotation policy bytes.");
assert.ok(audit.candidateBackedModuleCount > 0, "Pipeline audit must discover candidate-backed progressive modules.");
assert.equal(audit.failures.length, 0, "Current repository progressive artifacts must form a valid fail-closed chain.");
assert.equal(audit.modules.length, audit.candidateBackedModuleCount);

const allowedStages = new Set([
  "candidate_ready_for_human_verification",
  "promoted_subsets_pending_aggregation",
  "promoted_pending_feature_annotation",
  "feature_annotation_draft",
  "feature_annotation_complete_pending_apply",
  "annotated_pending_controlled_manifest_review",
  "controlled_manifest_review_draft",
  "controlled_manifest_review_complete_pending_apply",
  "reviewed_pending_session_policy_rebuild",
]);
for (const module of audit.modules) {
  assert.ok(module.moduleId && module.targetCategory, "Every audited module must preserve registered identity.");
  assert.ok(module.candidate?.path && module.candidate.candidateCount > 0, `${module.moduleId} must retain a registered candidate bundle.`);
  assert.ok(allowedStages.has(module.stage), `Unexpected valid pipeline stage for ${module.moduleId}: ${module.stage}`);
  assert.ok(module.nextRequiredArtifact, `${module.moduleId} must expose its next required artifact/action.`);
  assert.notEqual(module.stage, "invalid_repository_state");
}

const counted = Object.values(audit.stageCounts).reduce((sum, value) => sum + value, 0);
assert.equal(counted, audit.modules.length, "Pipeline stage summary must account for every candidate-backed module.");

console.log("Progressive repository pipeline state audit passed.");
