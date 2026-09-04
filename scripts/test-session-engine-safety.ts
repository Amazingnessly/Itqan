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
      allowedExerciseTypes: ["reading_units", "vowels_sukun"],
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

const repository = new ControlledContentRepository([batch]);
const engine = new LessonSessionEngine(repository, blueprint);
const state = createInitialLearnerState();
const baseAttempt = { attemptedAt: "2026-08-24T08:00:00.000Z", outcome: "correct" as const };

assert.doesNotThrow(() => engine.record(state, { ...baseAttempt, itemId: "item-1", sessionId: "session-1" }));
assert.throws(() => engine.record(state, { ...baseAttempt, itemId: "item-1", sessionId: "unknown-session" }), /unknown lesson session/);
assert.throws(() => engine.record(state, { ...baseAttempt, itemId: "item-2", sessionId: "session-1" }), /outside lesson session/);

const lockedBlueprint: ExerciseBlueprint = { ...blueprint, id: "locked-blueprint", category: "vowels_sukun", sessions: [{ ...blueprint.sessions[0], id: "locked-session" }] };
const lockedEngine = new LessonSessionEngine(repository, lockedBlueprint);
assert.throws(() => lockedEngine.record(state, { ...baseAttempt, itemId: "item-1", sessionId: "locked-session" }), /locked lesson category/);

const timingSample = { preparationMs: 10, readingMs: 20, totalMs: 30 };
const hiddenTiming = engine.record(state, { ...baseAttempt, itemId: "item-1", sessionId: "session-1", timing: timingSample });
assert.deepEqual(hiddenTiming.attempts.at(-1)?.timing, timingSample);

const timingOffBlueprint: ExerciseBlueprint = {
  ...blueprint,
  sessions: [
    blueprint.sessions[0],
    {
      ...blueprint.sessions[1],
      interactions: [{ ...blueprint.sessions[1].interactions[0], timing: "off" }],
    },
  ],
};
const timingOffEngine = new LessonSessionEngine(repository, timingOffBlueprint);
const timingOffState = timingOffEngine.record(state, { ...baseAttempt, itemId: "item-2", sessionId: "session-2", timing: timingSample });
assert.equal(timingOffState.attempts.at(-1)?.timing, undefined);

const voiceSample = { attempted: true, providerScore: 0.8, providerConfidence: 0.7 };
const optionalVoiceState = engine.record(state, { ...baseAttempt, itemId: "item-1", sessionId: "session-1", voice: voiceSample });
assert.deepEqual(optionalVoiceState.attempts.at(-1)?.voice, voiceSample);

const voiceOffBlueprint: ExerciseBlueprint = {
  ...blueprint,
  sessions: [
    {
      ...blueprint.sessions[0],
      interactions: [{ ...blueprint.sessions[0].interactions[0], voice: "off" }],
    },
    blueprint.sessions[1],
  ],
};
const voiceOffEngine = new LessonSessionEngine(repository, voiceOffBlueprint);
const voiceOffState = voiceOffEngine.record(state, { ...baseAttempt, itemId: "item-1", sessionId: "session-1", voice: voiceSample });
assert.equal(voiceOffState.attempts.at(-1)?.voice, undefined);

const duplicateSessionIds: ExerciseBlueprint = {
  ...blueprint,
  sessions: [blueprint.sessions[0], { ...blueprint.sessions[1], id: "session-1" }],
};
assert.throws(() => repository.validateBlueprint(duplicateSessionIds), /Duplicate or empty lesson session id/);

const emptySession: ExerciseBlueprint = {
  ...blueprint,
  sessions: [{ ...blueprint.sessions[0], interactionCount: 0, interactions: [] }],
};
assert.throws(() => repository.validateBlueprint(emptySession), /Empty lesson session blocked/);

const invalidOrder: ExerciseBlueprint = {
  ...blueprint,
  sessions: [{ ...blueprint.sessions[0], interactions: [{ ...blueprint.sessions[0].interactions[0], order: 2 }] }],
};
assert.throws(() => repository.validateBlueprint(invalidOrder), /Invalid interaction order/);

const invalidPrecision = {
  ...blueprint,
  sessions: [{ ...blueprint.sessions[0], interactions: [{ ...blueprint.sessions[0].interactions[0], precisionRequired: false }] }],
} as unknown as ExerciseBlueprint;
assert.throws(() => repository.validateBlueprint(invalidPrecision), /Precision must remain required/);

const invalidTiming = {
  ...blueprint,
  sessions: [{ ...blueprint.sessions[0], interactions: [{ ...blueprint.sessions[0].interactions[0], timing: "visible" }] }],
} as unknown as ExerciseBlueprint;
assert.throws(() => repository.validateBlueprint(invalidTiming), /Invalid timing policy/);

const invalidVoice = {
  ...blueprint,
  sessions: [{ ...blueprint.sessions[0], interactions: [{ ...blueprint.sessions[0].interactions[0], voice: "required" }] }],
} as unknown as ExerciseBlueprint;
assert.throws(() => repository.validateBlueprint(invalidVoice), /Invalid voice policy/);

const invalidArabicSourcePolicy = {
  ...blueprint,
  sessions: [{ ...blueprint.sessions[0], interactions: [{ ...blueprint.sessions[0].interactions[0], visibleArabicComesFromManifestOnly: false }] }],
} as unknown as ExerciseBlueprint;
assert.throws(() => repository.validateBlueprint(invalidArabicSourcePolicy), /Visible Arabic source policy violated/);

for (const unsafePolicy of [
  { ...blueprint.unlockPolicy, singleSessionCompletionIsMastery: true },
  { ...blueprint.unlockPolicy, requiresMultipleContexts: false },
  { ...blueprint.unlockPolicy, requiresDelayedCheck: false },
  { ...blueprint.unlockPolicy, speedCanNeverCompensateForErrors: false },
]) {
  const unsafe = { ...blueprint, unlockPolicy: unsafePolicy } as unknown as ExerciseBlueprint;
  assert.throws(() => repository.validateBlueprint(unsafe), /Unsafe mastery policy/);
}

const unsafeTimingPolicy = {
  ...blueprint,
  unlockPolicy: { ...blueprint.unlockPolicy, timingOnlyAfterPrecisionStability: false },
} as unknown as ExerciseBlueprint;
assert.throws(() => repository.validateBlueprint(unsafeTimingPolicy), /Unsafe timing policy/);

console.log("Session engine safety tests passed.");
