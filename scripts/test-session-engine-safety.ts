import assert from "node:assert/strict";
import { ControlledContentRepository } from "../src/learning/contentRepository";
import { createInitialLearnerState } from "../src/learning/mastery";
import { LessonSessionEngine } from "../src/learning/sessionEngine";
import type { AttemptRecord, ControlledBatch, ExerciseBlueprint } from "../src/learning/types";

const SESSION_1 = "UNITS-B01-S01";
const SESSION_2 = "UNITS-B01-S02";
const ITEM_1 = "S110-P003-001";
const ITEM_2 = "S110-P003-006";
const ITEM_3 = "S110-P021-002";
const ITEM_VOICE_OFF = "S110-P003-002";

const batch: ControlledBatch = {
  batchId: "test-batch",
  items: [
    {
      id: ITEM_1,
      arabicExact: "source-one",
      allowedExerciseTypes: ["reading_units", "vowels_sukun"],
      eligibleForActiveLesson: true,
      active: true,
      verification: { visualPass1: true, visualPass2: true, ambiguous: false },
    },
    {
      id: ITEM_2,
      arabicExact: "source-two",
      allowedExerciseTypes: ["reading_units"],
      eligibleForActiveLesson: true,
      active: true,
      verification: { visualPass1: true, visualPass2: true, ambiguous: false },
    },
    {
      id: ITEM_3,
      arabicExact: "source-three",
      allowedExerciseTypes: ["reading_units"],
      eligibleForActiveLesson: true,
      active: true,
      verification: { visualPass1: true, visualPass2: true, ambiguous: false },
    },
    {
      id: ITEM_VOICE_OFF,
      arabicExact: "source-four",
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
      id: SESSION_1,
      interactionCount: 1,
      interactions: [{ order: 1, mode: "exact_read", itemId: ITEM_1, precisionRequired: true, timing: "off", voice: "optional" }],
    },
    {
      id: SESSION_2,
      interactionCount: 1,
      interactions: [{ order: 1, mode: "exact_read", itemId: ITEM_2, precisionRequired: true, timing: "off", voice: "optional" }],
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

assert.doesNotThrow(() => engine.record(state, { ...baseAttempt, itemId: ITEM_1, sessionId: SESSION_1 }));
assert.throws(() => engine.record(state, { ...baseAttempt, attemptedAt: "2026-08-24T08:00:00Z", itemId: ITEM_1, sessionId: SESSION_1 }), /invalid timestamp/);
const forgedFuture = new Date(Date.now() + 10 * 60 * 1000).toISOString();
assert.throws(() => engine.record(state, { ...baseAttempt, attemptedAt: forgedFuture, itemId: ITEM_1, sessionId: SESSION_1 }), /invalid timestamp/);
assert.throws(() => engine.record(state, { ...baseAttempt, itemId: ITEM_1, sessionId: "unknown-session" }), /unknown lesson session/);
assert.throws(() => engine.record(state, { ...baseAttempt, itemId: ITEM_2, sessionId: SESSION_1 }), /outside lesson session/);

const unknownRegistryBlueprint: ExerciseBlueprint = {
  ...blueprint,
  id: "unknown-registry-session-blueprint",
  sessions: [{ ...blueprint.sessions[0], id: "runtime-only-session" }],
};
const unknownRegistryEngine = new LessonSessionEngine(repository, unknownRegistryBlueprint);
assert.throws(() => unknownRegistryEngine.getSession("runtime-only-session"), /Unknown controlled lesson session blocked/);
assert.throws(
  () => unknownRegistryEngine.record(state, { ...baseAttempt, itemId: ITEM_1, sessionId: "runtime-only-session" }),
  /Unknown controlled lesson session blocked/,
);

const unauthorizedTupleBlueprint: ExerciseBlueprint = {
  ...blueprint,
  id: "unauthorized-registry-tuple-blueprint",
  sessions: [{
    ...blueprint.sessions[0],
    interactions: [{ ...blueprint.sessions[0].interactions[0], itemId: ITEM_3 }],
  }],
};
const unauthorizedTupleEngine = new LessonSessionEngine(repository, unauthorizedTupleBlueprint);
assert.throws(() => unauthorizedTupleEngine.getSession(SESSION_1), /Unauthorized controlled lesson interaction blocked/);
assert.throws(
  () => unauthorizedTupleEngine.record(state, { ...baseAttempt, itemId: ITEM_3, sessionId: SESSION_1 }),
  /Unauthorized controlled lesson interaction blocked/,
);

const timingEscalationBlueprint: ExerciseBlueprint = {
  ...blueprint,
  id: "timing-escalation-blueprint",
  sessions: [{
    ...blueprint.sessions[0],
    interactions: [{ ...blueprint.sessions[0].interactions[0], timing: "hidden" }],
  }],
};
const timingEscalationEngine = new LessonSessionEngine(repository, timingEscalationBlueprint);
assert.throws(() => timingEscalationEngine.getSession(SESSION_1), /Controlled observation policy mismatch blocked/);
assert.throws(
  () => timingEscalationEngine.record(state, { ...baseAttempt, itemId: ITEM_1, sessionId: SESSION_1 }),
  /Controlled observation policy mismatch blocked/,
);

const voiceEscalationBlueprint: ExerciseBlueprint = {
  ...blueprint,
  id: "voice-escalation-blueprint",
  sessions: [{
    ...blueprint.sessions[0],
    interactions: [{
      ...blueprint.sessions[0].interactions[0],
      itemId: ITEM_VOICE_OFF,
      timing: "off",
      voice: "optional",
    }],
  }],
};
const voiceEscalationEngine = new LessonSessionEngine(repository, voiceEscalationBlueprint);
assert.throws(() => voiceEscalationEngine.getSession(SESSION_1), /Controlled observation policy mismatch blocked/);
assert.throws(
  () => voiceEscalationEngine.record(state, { ...baseAttempt, itemId: ITEM_VOICE_OFF, sessionId: SESSION_1 }),
  /Controlled observation policy mismatch blocked/,
);

const inactiveBatch: ControlledBatch = {
  ...batch,
  batchId: "inactive-test-batch",
  items: batch.items.map((item) => item.id === ITEM_2 ? { ...item, active: false } : item),
};
const inactiveEngine = new LessonSessionEngine(new ControlledContentRepository([inactiveBatch]), blueprint);
assert.throws(
  () => inactiveEngine.record(state, { ...baseAttempt, itemId: ITEM_2, sessionId: SESSION_2 }),
  /Inactive controlled-content item blocked/,
);

const lockedBlueprint: ExerciseBlueprint = { ...blueprint, id: "locked-blueprint", category: "vowels_sukun", sessions: [{ ...blueprint.sessions[0], id: "locked-session" }] };
const lockedEngine = new LessonSessionEngine(repository, lockedBlueprint);
assert.throws(() => lockedEngine.record(state, { ...baseAttempt, itemId: ITEM_1, sessionId: "locked-session" }), /locked lesson category/);

const timingSample = { preparationMs: 10, readingMs: 20, totalMs: 30 };
const stableTuples = [
  ["UNITS-B01-S01", "S110-P003-001"],
  ["UNITS-B01-S01", "S110-P003-002"],
  ["UNITS-B01-S01", "S110-P003-003"],
  ["UNITS-B01-S01", "S110-P003-004"],
  ["UNITS-B01-S02", "S110-P003-006"],
  ["UNITS-B01-S02", "S110-P003-007"],
  ["UNITS-B01-S02", "S110-P003-008"],
  ["UNITS-B01-S02", "S110-P003-009"],
  ["UNITS-B01-S03", "S110-P003-011"],
  ["UNITS-B01-S03", "S110-P003-012"],
  ["UNITS-B01-S03", "S110-P003-013"],
  ["UNITS-B01-S03", "S110-P003-014"],
] as const;
const stableAttempts: AttemptRecord[] = stableTuples.map(([sessionId, itemId], index) => ({
  category: "reading_units",
  sessionId,
  itemId,
  attemptedAt: new Date(Date.UTC(2026, 7, 23, 8, index)).toISOString(),
  outcome: "correct",
}));
const precisionStableState = { ...createInitialLearnerState(), attempts: stableAttempts };
const timingOffState = engine.record(precisionStableState, {
  attemptedAt: "2026-08-24T09:01:00.000Z",
  outcome: "correct",
  itemId: ITEM_2,
  sessionId: SESSION_2,
  timing: timingSample,
});
assert.equal(timingOffState.attempts.at(-1)?.timing, undefined);

const voiceSample = { attempted: true, providerScore: 0.8, providerConfidence: 0.7 };
const optionalVoiceState = engine.record(state, { ...baseAttempt, itemId: ITEM_1, sessionId: SESSION_1, voice: voiceSample });
assert.deepEqual(optionalVoiceState.attempts.at(-1)?.voice, voiceSample);

const voiceOffBlueprint: ExerciseBlueprint = {
  ...blueprint,
  id: "canonical-voice-off-blueprint",
  sessions: [{
    ...blueprint.sessions[0],
    interactions: [{
      ...blueprint.sessions[0].interactions[0],
      itemId: ITEM_VOICE_OFF,
      timing: "off",
      voice: "off",
    }],
  }],
};
const voiceOffEngine = new LessonSessionEngine(repository, voiceOffBlueprint);
const voiceOffState = voiceOffEngine.record(state, { ...baseAttempt, itemId: ITEM_VOICE_OFF, sessionId: SESSION_1, voice: voiceSample });
assert.equal(voiceOffState.attempts.at(-1)?.voice, undefined);

const duplicateSessionIds: ExerciseBlueprint = {
  ...blueprint,
  sessions: [blueprint.sessions[0], { ...blueprint.sessions[1], id: SESSION_1 }],
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

const invalidMode = {
  ...blueprint,
  sessions: [{ ...blueprint.sessions[0], interactions: [{ ...blueprint.sessions[0].interactions[0], mode: "unsupported_mode" }] }],
} as unknown as ExerciseBlueprint;
assert.throws(() => repository.validateBlueprint(invalidMode), /Unsupported interaction mode/);

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
