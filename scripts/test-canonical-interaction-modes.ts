import assert from "node:assert/strict";
import fs from "node:fs";
import { ControlledContentRepository } from "../src/learning/contentRepository";
import { SUPPORTED_INTERACTION_MODES } from "../src/learning/interactionModes";
import { createInitialLearnerState } from "../src/learning/mastery";
import { LessonSessionEngine } from "../src/learning/sessionEngine";
import type { ControlledBatch, ExerciseBlueprint } from "../src/learning/types";

function loadJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

const batch = loadJson<ControlledBatch>("public/content/verified/s110-batch01.json");
const blueprint = loadJson<ExerciseBlueprint>("public/content/blueprints/units-batch01.json");
const repository = new ControlledContentRepository([batch]);
const session = blueprint.sessions.find((candidate) => candidate.id === "UNITS-B01-S01")!;
const firstInteraction = session.interactions[0];
const alternateMode = SUPPORTED_INTERACTION_MODES.find((mode) => mode !== firstInteraction.mode)!;
const mutatedSession = {
  ...session,
  interactions: session.interactions.map((interaction, index) =>
    index === 0 ? { ...interaction, mode: alternateMode } : interaction
  ),
};
const mutatedBlueprint: ExerciseBlueprint = {
  ...blueprint,
  id: "runtime-mode-mismatch-blueprint",
  sessions: [mutatedSession],
};

assert.doesNotThrow(() => repository.validateBlueprint(mutatedBlueprint));
const engine = new LessonSessionEngine(repository, mutatedBlueprint);
assert.throws(
  () => engine.getSession(session.id),
  /Controlled lesson interaction mode mismatch blocked/,
);
assert.throws(
  () => engine.record(createInitialLearnerState(), {
    itemId: firstInteraction.itemId,
    sessionId: session.id,
    attemptedAt: "2026-08-24T08:00:00.000Z",
    outcome: "correct",
  }),
  /Controlled lesson interaction mode mismatch blocked/,
);

console.log("Canonical interaction mode safety tests passed.");
