import assert from "node:assert/strict";
import {
  loadFeatureAnnotationPolicy,
  readJson,
  validateFeatureAnnotationPolicy,
} from "./progressive-verification-lib.mjs";

const registry = readJson("public/content/source-intake/progressive-support.json");
const loaded = loadFeatureAnnotationPolicy(process.cwd());
const { policy } = loaded;

assert.match(loaded.sha256, /^[a-f0-9]{64}$/);
assert.equal(policy.schemaVersion, "0.1");
assert.equal(policy.kind, "itqan-progressive-feature-annotation-policy");
assert.doesNotThrow(() => validateFeatureAnnotationPolicy(policy));

const policyModuleIds = policy.modules.map((entry) => entry.id).sort();
const candidateModuleIds = registry.modules
  .filter((entry) => typeof entry.candidateBundle === "string" && entry.candidateBundle.length > 0)
  .map((entry) => entry.id)
  .sort();

assert.deepEqual(
  policyModuleIds,
  candidateModuleIds,
  "Every registered provisional candidate module must have exactly one controlled feature-annotation policy.",
);

const registryById = new Map(registry.modules.map((entry) => [entry.id, entry]));
for (const modulePolicy of policy.modules) {
  const module = registryById.get(modulePolicy.id);
  assert.ok(module, `Policy module ${modulePolicy.id} must exist in the progressive registry.`);
  assert.equal(
    modulePolicy.targetCategory,
    module.targetCategory,
    `Policy target category must match the registry for ${modulePolicy.id}.`,
  );
}

assert.deepEqual(
  policy.controlledFocusMarks.map((entry) => entry.id),
  ["fathah", "kasrah", "dammah", "tanwin", "sukun", "shaddah"],
);
assert.deepEqual(
  policy.controlledArticleClasses.map((entry) => entry.id),
  ["qamariyyah", "shamsiyyah"],
);
assert.deepEqual(
  policy.controlledMaterialShapes.map((entry) => entry.id),
  ["isolated_word", "two_words", "multi_word"],
);

const duplicateModule = structuredClone(policy);
duplicateModule.modules.push(structuredClone(duplicateModule.modules[0]));
assert.throws(
  () => validateFeatureAnnotationPolicy(duplicateModule),
  /duplicate module rule/,
  "Duplicate module policies must fail closed.",
);

const unsupportedMark = structuredClone(policy);
unsupportedMark.modules[0].requiredMarks = ["not_controlled"];
assert.throws(
  () => validateFeatureAnnotationPolicy(unsupportedMark),
  /unsupported mark/,
  "Module rules may only use controlled focus-mark vocabulary.",
);

const contradictoryMark = structuredClone(policy);
contradictoryMark.modules[0].requiredMarks = ["sukun"];
contradictoryMark.modules[0].forbiddenMarks = ["sukun"];
assert.throws(
  () => validateFeatureAnnotationPolicy(contradictoryMark),
  /both requires and forbids/,
  "A module policy must not both require and forbid the same mark.",
);

const arabicPolicy = structuredClone(policy);
arabicPolicy.modules[0].guidanceFr = "ا";
assert.throws(
  () => validateFeatureAnnotationPolicy(arabicPolicy),
  /must not embed Arabic/,
  "Shared annotation policy must not become a hidden Arabic-content source.",
);

console.log("Shared progressive feature-annotation policy contract passed.");
