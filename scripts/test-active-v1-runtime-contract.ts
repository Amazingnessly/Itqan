import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { availableSessionIdsForActiveLesson } from "../src/learning/attemptRegistry.generated";
import { CATEGORY_RESOURCES, learningStageForSession } from "../src/learning/categoryCatalog";
import { ControlledContentRepository } from "../src/learning/contentRepository";
import { LessonSessionEngine } from "../src/learning/sessionEngine";
import type {
  ControlledBatch,
  ControlledContentItem,
  ExerciseBlueprint,
  ExerciseCategory,
} from "../src/learning/types";

const categories: ExerciseCategory[] = [
  "reading_units",
  "vowels_sukun",
  "shaddah",
  "article_al",
  "linking",
  "fluent_reading",
];

function loadControlledJson<T>(url: string): T {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), url.replace(/^\//, "public/")), "utf8"),
  ) as T;
}

function mutateItem(
  batch: ControlledBatch,
  itemId: string,
  mutate: (item: ControlledContentItem) => void,
): ControlledBatch {
  const mutated = structuredClone(batch);
  const item = mutated.items.find((candidate) => candidate.id === itemId);
  assert.ok(item, `Expected controlled item ${itemId}.`);
  mutate(item);
  return mutated;
}

for (const category of categories) {
  const resources = CATEGORY_RESOURCES[category];
  const batch = loadControlledJson<ControlledBatch>(resources.manifestUrl);
  const blueprint = loadControlledJson<ExerciseBlueprint>(resources.blueprintUrl);
  const activeSessionIds = availableSessionIdsForActiveLesson(category);
  assert.ok(activeSessionIds.length > 0, `Expected active V1 sessions for ${category}.`);
  assert.equal(new Set(activeSessionIds).size, activeSessionIds.length);

  const repository = new ControlledContentRepository([batch]);
  const engine = new LessonSessionEngine(repository, blueprint);
  const blueprintSessionIds = new Set(blueprint.sessions.map((session) => session.id));

  for (const sessionId of activeSessionIds) {
    assert.equal(blueprintSessionIds.has(sessionId), true, `${sessionId} must exist in its blueprint.`);
    assert.ok(
      learningStageForSession(category, sessionId),
      `${sessionId} must map to one of the seven pedagogical stages.`,
    );

    const sourceSession = blueprint.sessions.find((session) => session.id === sessionId);
    assert.ok(sourceSession);
    const resolved = engine.getSession(sessionId);
    assert.equal(resolved.length, sourceSession.interactionCount);
    assert.deepEqual(
      resolved.map(({ sessionId: resolvedSessionId, category: resolvedCategory, interaction }) => ({
        sessionId: resolvedSessionId,
        category: resolvedCategory,
        itemId: interaction.itemId,
        order: interaction.order,
      })),
      sourceSession.interactions.map((interaction) => ({
        sessionId,
        category,
        itemId: interaction.itemId,
        order: interaction.order,
      })),
    );

    for (const entry of resolved) {
      const controlledItem = batch.items.find((item) => item.id === entry.interaction.itemId);
      assert.ok(controlledItem);
      assert.equal(entry.arabicExact, controlledItem.arabicExact);
    }
  }

  for (const session of blueprint.sessions) {
    if (activeSessionIds.includes(session.id)) continue;
    assert.throws(() => engine.getSession(session.id), /Inactive lesson session blocked/);
  }

  const firstActiveSession = blueprint.sessions.find((session) => session.id === activeSessionIds[0]);
  assert.ok(firstActiveSession?.interactions.length);
  const guardedItemId = firstActiveSession.interactions[0].itemId;

  for (const [label, mutate] of [
    ["visual pass 1", (item: ControlledContentItem) => { item.verification.visualPass1 = false; }],
    ["visual pass 2", (item: ControlledContentItem) => { item.verification.visualPass2 = false; }],
    ["ambiguity", (item: ControlledContentItem) => { item.verification.ambiguous = true; }],
    ["lesson eligibility", (item: ControlledContentItem) => { item.eligibleForActiveLesson = false; }],
  ] as const) {
    const guardedRepository = new ControlledContentRepository([
      mutateItem(batch, guardedItemId, mutate),
    ]);
    assert.throws(
      () => new LessonSessionEngine(guardedRepository, blueprint),
      /Blocked unverified\/ambiguous item|not eligible for active lessons/,
      `${category} must fail closed when ${label} is invalid.`,
    );
  }

  const inactiveRepository = new ControlledContentRepository([
    mutateItem(batch, guardedItemId, (item) => { item.active = false; }),
  ]);
  const inactiveEngine = new LessonSessionEngine(inactiveRepository, blueprint);
  assert.throws(
    () => inactiveEngine.getSession(firstActiveSession.id),
    /Inactive controlled-content item blocked/,
  );

  const metadataRepository = new ControlledContentRepository([
    mutateItem(batch, guardedItemId, (item) => { item.integrity.normalizationApplied = true; }),
  ]);
  const metadataEngine = new LessonSessionEngine(metadataRepository, blueprint);
  assert.throws(
    () => metadataEngine.getSession(firstActiveSession.id),
    /Controlled-content metadata mismatch blocked/,
  );
}

console.log("Active V1 runtime session and fail-closed content guard tests passed.");
