import fs from "node:fs";
import path from "node:path";
import { auditProgressivePipelineState } from "./progressive-pipeline-audit-lib.mjs";
import { readJson, sha256Bytes } from "./progressive-verification-lib.mjs";

const LOCKED_STAGE_ORDER = [
  "reading_units",
  "vowels_sukun",
  "article_qamariyyah",
  "shaddah",
  "article_shamsiyyah",
  "linking",
  "fluent_reading",
];

const LOCKED_CATEGORIES = new Set([
  "reading_units",
  "vowels_sukun",
  "shaddah",
  "article_al",
  "linking",
  "fluent_reading",
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function uniqueStrings(values, label) {
  assert(Array.isArray(values), `${label} must be an array.`);
  const seen = new Set();
  for (const value of values) {
    assert(typeof value === "string" && value.length > 0, `${label} contains an invalid value.`);
    assert(!seen.has(value), `${label} contains duplicate value ${value}.`);
    seen.add(value);
  }
  return seen;
}

export function validateSessionRebuildReadinessPolicy(policy, registry) {
  assert(policy && typeof policy === "object", "Session-rebuild readiness policy must be an object.");
  assert(policy.schemaVersion === "0.1", "Unsupported session-rebuild readiness policy schema.");
  assert(policy.kind === "itqan-progressive-session-rebuild-readiness-policy", "Unexpected session-rebuild readiness policy kind.");
  assert(policy.activationMutationAllowed === false, "Session-rebuild readiness policy must forbid activation mutation.");
  assert(policy.blueprintMutationAllowed === false, "Session-rebuild readiness policy must forbid blueprint mutation.");
  assert(policy.runtimeFingerprintMutationAllowed === false, "Session-rebuild readiness policy must forbid runtime-fingerprint mutation.");
  assert(policy.itemSelectionUsesReviewedCandidatesOnly === true, "Session-rebuild readiness policy must use reviewed candidates only.");

  const arabicPattern = /[\u0600-\u06ff]/u;
  assert(!arabicPattern.test(JSON.stringify(policy)), "Session-rebuild readiness policy must not embed Arabic exercise content.");

  assert(Array.isArray(policy.stages), "Session-rebuild readiness stages must be an array.");
  assert(
    JSON.stringify(policy.stages.map((stage) => stage.id)) === JSON.stringify(LOCKED_STAGE_ORDER),
    "Session-rebuild readiness policy must preserve the locked seven-stage learner order.",
  );

  const registryById = new Map((registry.modules ?? []).map((module) => [module.id, module]));
  const candidateBackedModules = new Set(
    (registry.modules ?? []).filter((module) => module.candidateBundle).map((module) => module.id),
  );
  const requiredModuleUses = new Map();

  for (const [index, stage] of policy.stages.entries()) {
    assert(LOCKED_CATEGORIES.has(stage.category), `Session-rebuild stage ${stage.id} has unsupported category.`);
    if (stage.id === "article_qamariyyah" || stage.id === "article_shamsiyyah") {
      assert(stage.category === "article_al", `Article phase ${stage.id} must remain inside article_al.`);
      assert(stage.phase === (stage.id === "article_qamariyyah" ? "qamariyyah" : "shamsiyyah"), `Article phase tag drifted for ${stage.id}.`);
    }

    const prerequisites = uniqueStrings(stage.prerequisiteStages, `${stage.id} prerequisiteStages`);
    for (const prerequisite of prerequisites) {
      const prerequisiteIndex = LOCKED_STAGE_ORDER.indexOf(prerequisite);
      assert(prerequisiteIndex >= 0 && prerequisiteIndex < index, `${stage.id} prerequisite must be an earlier locked stage: ${prerequisite}.`);
    }

    const requiredModules = uniqueStrings(stage.requiredReviewedModules, `${stage.id} requiredReviewedModules`);
    for (const moduleId of requiredModules) {
      const module = registryById.get(moduleId);
      assert(module?.candidateBundle, `${stage.id} requires unknown or non-candidate module ${moduleId}.`);
      assert(module.targetCategory === stage.category, `${stage.id} module ${moduleId} target category does not match stage category.`);
      assert(!requiredModuleUses.has(moduleId), `Candidate-backed module ${moduleId} is assigned to more than one rebuild stage.`);
      requiredModuleUses.set(moduleId, stage.id);
    }

    assert(Array.isArray(stage.derivedPools), `${stage.id} derivedPools must be an array.`);
    const derivedIds = new Set();
    for (const pool of stage.derivedPools) {
      assert(typeof pool.id === "string" && pool.id.length > 0, `${stage.id} derived pool id is missing.`);
      assert(!derivedIds.has(pool.id), `${stage.id} duplicates derived pool ${pool.id}.`);
      derivedIds.add(pool.id);
      const sourceModules = uniqueStrings(pool.sourceModules, `${stage.id}/${pool.id} sourceModules`);
      assert(Number.isInteger(pool.targetDistinctItems) && pool.targetDistinctItems > 0, `${stage.id}/${pool.id} targetDistinctItems is invalid.`);
      assert(Number.isInteger(pool.minimumPerSourceModule) && pool.minimumPerSourceModule > 0, `${stage.id}/${pool.id} minimumPerSourceModule is invalid.`);
      assert(pool.noReplacementUntilExhausted === true, `${stage.id}/${pool.id} must forbid replacement until pools are exhausted.`);
      assert(pool.reuseExistingReviewedItemIdsOnly === true, `${stage.id}/${pool.id} must reuse reviewed item ids only.`);
      assert(pool.targetDistinctItems >= pool.minimumPerSourceModule * sourceModules.size, `${stage.id}/${pool.id} target distinct count cannot satisfy source minima.`);
      for (const moduleId of sourceModules) {
        assert(requiredModules.has(moduleId), `${stage.id}/${pool.id} source module ${moduleId} must also be a required reviewed module for the stage.`);
      }

      const registryPool = registryById.get(pool.id);
      assert(registryPool && !registryPool.candidateBundle, `${stage.id}/${pool.id} must remain a derived non-candidate registry module.`);
      assert(registryPool.candidateStatus === "derived_from_human_verified_prior_modules", `${stage.id}/${pool.id} registry status must remain derived from human-verified prior modules.`);
      const composition = registryPool.derivedCandidateComposition;
      assert(composition, `${stage.id}/${pool.id} registry composition is missing.`);
      assert(JSON.stringify(composition.sourceModules) === JSON.stringify(pool.sourceModules), `${stage.id}/${pool.id} source modules drifted from registry composition.`);
      assert(composition.targetDistinctItems === pool.targetDistinctItems, `${stage.id}/${pool.id} target distinct count drifted from registry composition.`);
      assert(composition.minimumPerSourceModule === pool.minimumPerSourceModule, `${stage.id}/${pool.id} source minimum drifted from registry composition.`);
      assert(composition.noReplacementUntilExhausted === pool.noReplacementUntilExhausted, `${stage.id}/${pool.id} replacement policy drifted from registry composition.`);
    }

    assert(Array.isArray(stage.externalBlockers), `${stage.id} externalBlockers must be an array.`);
    const blockerCodes = new Set();
    for (const blocker of stage.externalBlockers) {
      assert(typeof blocker?.code === "string" && blocker.code.length > 0, `${stage.id} external blocker code is missing.`);
      assert(!blockerCodes.has(blocker.code), `${stage.id} duplicates external blocker ${blocker.code}.`);
      blockerCodes.add(blocker.code);
      assert(typeof blocker.status === "string" && blocker.status.length > 0, `${stage.id}/${blocker.code} blocker status is missing.`);
      assert(typeof blocker.note === "string" && blocker.note.length > 0, `${stage.id}/${blocker.code} blocker note is missing.`);
    }
  }

  assert(
    requiredModuleUses.size === candidateBackedModules.size
      && [...candidateBackedModules].every((moduleId) => requiredModuleUses.has(moduleId)),
    "Session-rebuild readiness policy must account for every candidate-backed module exactly once.",
  );

  const qamariyyah = policy.stages.find((stage) => stage.id === "article_qamariyyah");
  const qamariyyahGap = qamariyyah?.externalBlockers?.find((blocker) => blocker.code === "verified_qamariyyah_source_pool_required");
  assert(qamariyyahGap?.issue === 235 && qamariyyahGap?.status === "open_source_gap", "Qamariyyah readiness must preserve the explicit #235 verified-source gap.");

  const fluent = policy.stages.find((stage) => stage.id === "fluent_reading");
  assert(
    fluent?.externalBlockers?.some((blocker) => blocker.code === "verified_fluent_reading_pool_required"),
    "Fluent-reading readiness must remain blocked until a separately verified pool exists.",
  );

  return policy;
}

function moduleInventoryFromRepository(repoRoot, pipelineAudit) {
  const inventory = new Map();
  for (const module of pipelineAudit.modules) {
    const reviewedPath = path.resolve(
      repoRoot,
      "public/content/source-intake/reviewed",
      `${module.moduleId}.json`,
    );
    if (module.stage !== "reviewed_pending_session_policy_rebuild") {
      inventory.set(module.moduleId, {
        reviewed: false,
        itemIds: [],
        currentStage: module.stage,
        nextRequiredArtifact: module.nextRequiredArtifact,
      });
      continue;
    }
    assert(fs.existsSync(reviewedPath) && fs.statSync(reviewedPath).isFile(), `Reviewed module file is missing for ${module.moduleId}.`);
    const reviewed = readJson(reviewedPath);
    assert(Array.isArray(reviewed.items) && reviewed.items.length > 0, `Reviewed module ${module.moduleId} has no reviewed items.`);
    const itemIds = reviewed.items.map((item) => item.id);
    assert(new Set(itemIds).size === itemIds.length, `Reviewed module ${module.moduleId} contains duplicate item ids.`);
    inventory.set(module.moduleId, {
      reviewed: true,
      itemIds,
      currentStage: module.stage,
      nextRequiredArtifact: module.nextRequiredArtifact,
      reviewedArtifactSha256: sha256Bytes(fs.readFileSync(reviewedPath)),
    });
  }
  return inventory;
}

export function evaluateSessionRebuildReadiness(policy, moduleInventory) {
  const stages = [];
  const stageById = new Map();

  for (const stagePolicy of policy.stages) {
    const moduleBlockers = [];
    const moduleCounts = {};
    for (const moduleId of stagePolicy.requiredReviewedModules) {
      const inventory = moduleInventory.get(moduleId);
      const count = inventory?.reviewed ? inventory.itemIds.length : 0;
      moduleCounts[moduleId] = count;
      if (!inventory?.reviewed) {
        moduleBlockers.push({
          code: "reviewed_module_required",
          moduleId,
          currentStage: inventory?.currentStage ?? "missing_pipeline_module",
          nextRequiredArtifact: inventory?.nextRequiredArtifact ?? "repair_session_rebuild_policy",
        });
      }
    }

    const derivedPools = stagePolicy.derivedPools.map((pool) => {
      const sourceCounts = {};
      const distinctIds = new Set();
      let sourceMinimumsSatisfied = true;
      for (const moduleId of pool.sourceModules) {
        const inventory = moduleInventory.get(moduleId);
        const ids = inventory?.reviewed ? inventory.itemIds : [];
        sourceCounts[moduleId] = ids.length;
        if (ids.length < pool.minimumPerSourceModule) sourceMinimumsSatisfied = false;
        for (const itemId of ids) distinctIds.add(itemId);
      }
      const targetDistinctSatisfied = distinctIds.size >= pool.targetDistinctItems;
      return {
        id: pool.id,
        sourceCounts,
        availableDistinctItemCount: distinctIds.size,
        minimumPerSourceModule: pool.minimumPerSourceModule,
        targetDistinctItems: pool.targetDistinctItems,
        sourceMinimumsSatisfied,
        targetDistinctSatisfied,
        ready: sourceMinimumsSatisfied && targetDistinctSatisfied,
      };
    });

    const derivedBlockers = derivedPools
      .filter((pool) => !pool.ready)
      .map((pool) => ({
        code: "derived_reviewed_pool_insufficient",
        poolId: pool.id,
        sourceCounts: pool.sourceCounts,
        availableDistinctItemCount: pool.availableDistinctItemCount,
        minimumPerSourceModule: pool.minimumPerSourceModule,
        targetDistinctItems: pool.targetDistinctItems,
      }));

    const externalBlockers = stagePolicy.externalBlockers.map((blocker) => ({ ...blocker }));
    const corpusReady =
      moduleBlockers.length === 0
      && derivedBlockers.length === 0
      && externalBlockers.length === 0;

    const prerequisiteBlockers = stagePolicy.prerequisiteStages
      .filter((stageId) => stageById.get(stageId)?.rebuildReady !== true)
      .map((stageId) => ({
        code: "prerequisite_stage_not_ready",
        stageId,
      }));

    const prerequisitesReady = prerequisiteBlockers.length === 0;
    const rebuildReady = corpusReady && prerequisitesReady;
    const blockers = [
      ...moduleBlockers,
      ...derivedBlockers,
      ...externalBlockers,
      ...prerequisiteBlockers,
    ];

    const report = {
      id: stagePolicy.id,
      category: stagePolicy.category,
      ...(stagePolicy.phase ? { phase: stagePolicy.phase } : {}),
      corpusReady,
      prerequisitesReady,
      rebuildReady,
      requiredModuleItemCounts: moduleCounts,
      derivedPools,
      blockers,
      nextAction: rebuildReady
        ? "ready_for_inactive_session_rebuild_planning"
        : blockers[0]?.code ?? "review_readiness_policy",
    };
    stages.push(report);
    stageById.set(report.id, report);
  }

  return {
    stages,
    allStagesReady: stages.every((stage) => stage.rebuildReady),
    readyStageCount: stages.filter((stage) => stage.rebuildReady).length,
  };
}

export function auditProgressiveSessionRebuildReadiness({
  repoRoot = process.cwd(),
  registryPath = "public/content/source-intake/progressive-support.json",
  policyPath = "public/content/source-intake/session-rebuild-readiness-policy.json",
} = {}) {
  const registry = readJson(path.resolve(repoRoot, registryPath));
  const absolutePolicy = path.resolve(repoRoot, policyPath);
  const policyBytes = fs.readFileSync(absolutePolicy);
  const policy = JSON.parse(policyBytes.toString("utf8"));
  validateSessionRebuildReadinessPolicy(policy, registry);

  const pipelineAudit = auditProgressivePipelineState({ repoRoot, registryPath });
  assert(pipelineAudit.failures.length === 0, "Session-rebuild readiness requires a valid progressive repository artifact chain.");
  const moduleInventory = moduleInventoryFromRepository(repoRoot, pipelineAudit);
  const readiness = evaluateSessionRebuildReadiness(policy, moduleInventory);

  return {
    schemaVersion: "0.1",
    kind: "itqan-progressive-session-rebuild-readiness-audit",
    sourceDocumentId: registry.sourceDocument.id,
    sourceDocumentSha256: registry.sourceDocument.sha256,
    readinessPolicySha256: sha256Bytes(policyBytes),
    activationMutationAllowed: false,
    blueprintMutationAllowed: false,
    runtimeFingerprintMutationAllowed: false,
    pipelineStageCounts: pipelineAudit.stageCounts,
    ...readiness,
  };
}
