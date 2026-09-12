import assert from "node:assert/strict";
import { ControlledContentRepository } from "../src/learning/contentRepository";
import { createInitialLearnerState } from "../src/learning/mastery";
import { LessonSessionEngine } from "../src/learning/sessionEngine";
import type { AttemptRecord, ControlledBatch, ExerciseBlueprint } from "../src/learning/types";

const READING_SESSION = "UNITS-B01-S01";
const READING_ITEM = "S110-P003-001";

const batch: ControlledBatch = {
  batchId: "runtime-state-test",
  items: [{
    id: READING_ITEM,
    arabicExact: "source-one",
    allowedExerciseTypes: ["reading_units", "vowels_sukun"],
    eligibleForActiveLesson: true,
    active: true,
    verification: { visualPass1: true, visualPass2: true, ambiguous: false },
  }],
};

const unlockPolicy = {
  singleSessionCompletionIsMastery: false,
  requiresMultipleContexts: true,
  requiresDelayedCheck: true,
  speedCanNeverCompensateForErrors: true,
} as const;

function blueprint(category: "reading_units" | "vowels_sukun", sessionId: string): ExerciseBlueprint {
  return {
    id: `${category}-runtime-state-test`,
    category,
    status: "test",
    sessions: [{
      id: sessionId,
      interactionCount: 1,
      interactions: [{ order: 1, mode: "exact_read", itemId: READING_ITEM, precisionRequired: true, timing: "off", voice: "off" }],
    }],
    unlockPolicy,
  };
}

const repository = new ControlledContentRepository([batch]);
const readingEngine = new LessonSessionEngine(repository, blueprint("reading_units", READING_SESSION));
const lockedEngine = new LessonSessionEngine(repository, blueprint("vowels_sukun", "locked-session"));
const baseAttempt = { itemId: READING_ITEM, attemptedAt: new Date().toISOString(), outcome: "correct" as const };

const forgedUnlock = createInitialLearnerState();
forgedUnlock.skills.reading_units = { ...forgedUnlock.skills.reading_units, level: "excellence" };
assert.throws(
  () => lockedEngine.record(forgedUnlock, { ...baseAttempt, sessionId: "locked-session" }),
  /locked lesson category/,
);

const forgedAttempt: AttemptRecord = {
  itemId: "forged-item",
  category: "reading_units",
  sessionId: "forged-session",
  attemptedAt: new Date(Date.now() - 60_000).toISOString(),
  outcome: "correct",
};
const forgedHistory = createInitialLearnerState();
forgedHistory.attempts = [forgedAttempt];
forgedHistory.xp = 9999;
forgedHistory.skills.reading_units = { ...forgedHistory.skills.reading_units, level: "excellence", totalAttempts: 999 };
const reconciled = readingEngine.record(forgedHistory, { ...baseAttempt, sessionId: READING_SESSION });
assert.equal(reconciled.attempts.length, 1);
assert.equal(reconciled.attempts[0].sessionId, READING_SESSION);
assert.equal(reconciled.xp, 5);

console.log("Runtime learner-state reconciliation tests passed.");
