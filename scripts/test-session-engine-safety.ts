import assert from "node:assert/strict";
import { ControlledContentRepository } from "../src/learning/contentRepository";
import { createInitialLearnerState } from "../src/learning/mastery";
import { LessonSessionEngine } from "../src/learning/sessionEngine";
import type { ControlledBatch, ExerciseBlueprint } from "../src/learning/types";

const batch: ControlledBatch = {
  batchId: "test-batch",
  items: [
    {
      id: "item-1",
      arabicExact: "source-one",
      allowedExerciseTypes: ["reading_units"],
      eligibleForActiveLesson: true,
      active: true,
      verification: { visualPass1: true, visualPass2: true, ambiguous: false },
    },
    {
      id: "item-2",
      arabicExact: "source-two",
      allowedExerciseTypes: ["reading_units"],
      eligibleForActiveLesson: true,
      active: true,
      verification: { visualPass1: true, visualPass2: true, ambiguous: false },
    },
  ],
};

const blueprint: ExerciseBlueprint = {
  id: "test-blueprint",
  category: "reading_units",
  status: "test",
  sessions: [
    {
      id: "session-1",
      interactionCount: 1,
      interactions: [{ order: 1, mode: "exact_read", itemId: "item-1", precisionRequired: true, timing: "hidden", voice: "optional" }],
    },
    {
      id: "session-2",
      interactionCount: 1,
      interactions: [{ order: 1, mode: "exact_read", itemId: "item-2", precisionRequired: true, timing: "hidden", voice: "optional" }],
    },
  ],
  unlockPolicy: {
    singleSessionCompletionIsMastery: false,
    requiresMultipleContexts: true,
    requiresDelayedCheck: true,
    speedCanNeverCompensateForErrors: true,
  },
};

const engine = new LessonSessionEngine(new ControlledContentRepository([batch]), blueprint);
const state = createInitialLearnerState();
const baseAttempt = { attemptedAt: "2026-08-24T08:00:00.000Z", outcome: "correct" as const };

assert.doesNotThrow(() => engine.record(state, { ...baseAttempt, itemId: "item-1", sessionId: "session-1" }));
assert.throws(() => engine.record(state, { ...baseAttempt, itemId: "item-1", sessionId: "unknown-session" }), /unknown lesson session/);
assert.throws(() => engine.record(state, { ...baseAttempt, itemId: "item-2", sessionId: "session-1" }), /outside lesson session/);

console.log("Session engine safety tests passed.");
