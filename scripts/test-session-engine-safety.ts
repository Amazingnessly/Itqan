import assert from "node:assert/strict";
import fs from "node:fs";
import { ControlledContentRepository } from "../src/learning/contentRepository";
import { createInitialLearnerState } from "../src/learning/mastery";
import { LessonSessionEngine } from "../src/learning/sessionEngine";
import type { AttemptRecord, ControlledBatch, ExerciseBlueprint } from "../src/learning/types";

function loadJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function replaceSession(
  blueprint: ExerciseBlueprint,
  sessionId: string,
  replacement: ExerciseBlueprint["sessions"][number],
): ExerciseBlueprint {
  return {
    ...blueprint,
    sessions: blueprint.sessions.map((session) => session.id === sessionId ? replacement : session),
  };
}

const batch = loadJson<ControlledBatch>("public/content/verified/s110-batch01.json");
const blueprint = loadJson<ExerciseBlueprint>("public/content/blueprints/units-batch01.json");
const repository = new ControlledContentRepository([batch]);
const engine = new LessonSessionEngine(repository, blueprint);
const state = createInitialLearnerState();
const session1 = blueprint.sessions.find((session) => session.id === "UNITS-B01-S01")!;
const session2 = blueprint.sessions.find((session) => session.id === "UNITS-B01-S02")!;
const session3 = blueprint.sessions.find((session) => session.id === "UNITS-B01-S03")!;
const interaction1 = session1.interactions[0];
const session1ItemIds = new Set(session1.interactions.map((interaction) => interaction.itemId));
const outsideInteraction = session3.interactions.find((interaction) => !session1ItemIds.has(interaction.itemId))!;
const voiceOffInteraction = session1.interactions.find((interaction) => interaction.voice === "off")!;
const voiceOptionalInteraction = session1.interactions.find((interaction) => interaction.voice === "optional")!;
const timingOffInteraction = session2.interactions.find((interaction) => interaction.timing === "off")!;
const baseAttempt = { attemptedAt: "2026-08-24T08:00:00.000Z", outcome: "correct" as const };

assert.doesNotThrow(() => engine.record(state, {
  ...baseAttempt,
  itemId: interaction1.itemId,
  sessionId: session1.id,
}));
assert.throws(() => engine.record(state, {
  ...baseAttempt,
  attemptedAt: "2026-08-24T08:00:00Z",
  itemId: interaction1.itemId,
  sessionId: session1.id,
}), /invalid timestamp/);
const forgedFuture = new Date(Date.now() + 10 * 60 * 1000).toISOString();
assert.throws(() => engine.record(state, {
  ...baseAttempt,
  attemptedAt: forgedFuture,
  itemId: interaction1.itemId,
  sessionId: session1.id,
}), /invalid timestamp/);
assert.throws(() => engine.record(state, {
  ...baseAttempt,
  itemId: interaction1.itemId,
  sessionId: "unknown-session",
}), /unknown lesson session/);
assert.throws(() => engine.record(state, {
  ...baseAttempt,
  itemId: outsideInteraction.itemId,
  sessionId: session1.id,
}), /outside lesson session/);

const unknownRegistrySession = { ...session1, id: "runtime-only-session" };
const unknownRegistryBlueprint: ExerciseBlueprint = {
  ...blueprint,
  id: "unknown-registry-session-blueprint",
  sessions: [unknownRegistrySession],
};
const unknownRegistryEngine = new LessonSessionEngine(repository, unknownRegistryBlueprint);
assert.throws(() => unknownRegistryEngine.getSession(unknownRegistrySession.id), /Unknown controlled lesson session blocked/);
assert.throws(
  () => unknownRegistryEngine.record(state, {
    ...baseAttempt,
    itemId: interaction1.itemId,
    sessionId: unknownRegistrySession.id,
  }),
  /Unknown controlled lesson session blocked/,
);

const shortenedSession = {
  ...session1,
  interactionCount: session1.interactions.length - 1,
  interactions: session1.interactions.slice(0, -1),
};
const shortenedBlueprint: ExerciseBlueprint = {
  ...blueprint,
  id: "shortened-runtime-session-blueprint",
  sessions: [shortenedSession],
};
const shortenedEngine = new LessonSessionEngine(repository, shortenedBlueprint);
assert.throws(() => shortenedEngine.getSession(session1.id), /Controlled lesson item sequence mismatch blocked/);
assert.throws(
  () => shortenedEngine.record(state, {
    ...baseAttempt,
    itemId: interaction1.itemId,
    sessionId: session1.id,
  }),
  /Controlled lesson item sequence mismatch blocked/,
);

const reorderedInteractions = [
  { ...session1.interactions[1], order: 1 },
  { ...session1.interactions[0], order: 2 },
  ...session1.interactions.slice(2),
];
const reorderedSession = { ...session1, interactions: reorderedInteractions };
const reorderedEngine = new LessonSessionEngine(repository, {
  ...blueprint,
  id: "reordered-runtime-session-blueprint",
  sessions: [reorderedSession],
});
assert.throws(() => reorderedEngine.getSession(session1.id), /Controlled lesson item sequence mismatch blocked/);

const timingEscalatedSession = {
  ...session1,
  interactions: session1.interactions.map((interaction, index) =>
    index === 0 ? { ...interaction, timing: "hidden" as const } : interaction
  ),
};
const timingEscalationEngine = new LessonSessionEngine(repository, {
  ...blueprint,
  id: "timing-escalation-blueprint",
  sessions: [timingEscalatedSession],
});
assert.throws(() => timingEscalationEngine.getSession(session1.id), /Controlled observation policy mismatch blocked/);
assert.throws(
  () => timingEscalationEngine.record(state, {
    ...baseAttempt,
    itemId: interaction1.itemId,
    sessionId: session1.id,
  }),
  /Controlled observation policy mismatch blocked/,
);

const voiceEscalatedSession = {
  ...session1,
  interactions: session1.interactions.map((interaction) =>
    interaction.itemId === voiceOffInteraction.itemId
      ? { ...interaction, voice: "optional" as const }
      : interaction
  ),
};
const voiceEscalationEngine = new LessonSessionEngine(repository, {
  ...blueprint,
  id: "voice-escalation-blueprint",
  sessions: [voiceEscalatedSession],
});
assert.throws(() => voiceEscalationEngine.getSession(session1.id), /Controlled observation policy mismatch blocked/);
assert.throws(
  () => voiceEscalationEngine.record(state, {
    ...baseAttempt,
    itemId: voiceOffInteraction.itemId,
    sessionId: session1.id,
  }),
  /Controlled observation policy mismatch blocked/,
);

const inactiveBatch: ControlledBatch = {
  ...batch,
  batchId: "inactive-test-batch",
  items: batch.items.map((item) =>
    item.id === timingOffInteraction.itemId ? { ...item, active: false } : item
  ),
};
const inactiveEngine = new LessonSessionEngine(
  new ControlledContentRepository([inactiveBatch]),
  { ...blueprint, id: "inactive-item-blueprint", sessions: [session2] },
);
assert.throws(
  () => inactiveEngine.record(state, {
    ...baseAttempt,
    itemId: timingOffInteraction.itemId,
    sessionId: session2.id,
  }),
  /Inactive controlled-content item blocked/,
);

const batch02 = loadJson<ControlledBatch>("public/content/verified/s110-batch02.json");
const vowelsBlueprint = loadJson<ExerciseBlueprint>("public/content/blueprints/vowels_sukun-batch02.json");
const lockedEngine = new LessonSessionEngine(new ControlledContentRepository([batch02]), vowelsBlueprint);
const lockedSession = vowelsBlueprint.sessions[0];
const lockedInteraction = lockedSession.interactions[0];
assert.throws(() => lockedEngine.record(state, {
  ...baseAttempt,
  itemId: lockedInteraction.itemId,
  sessionId: lockedSession.id,
}), /locked lesson category/);

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
  itemId: timingOffInteraction.itemId,
  sessionId: session2.id,
  timing: timingSample,
});
assert.equal(timingOffState.attempts.at(-1)?.timing, undefined);

const voiceSample = { attempted: true, providerScore: 0.8, providerConfidence: 0.7 };
const optionalVoiceState = engine.record(state, {
  ...baseAttempt,
  itemId: voiceOptionalInteraction.itemId,
  sessionId: session1.id,
  voice: voiceSample,
});
assert.deepEqual(optionalVoiceState.attempts.at(-1)?.voice, voiceSample);

const voiceOffState = engine.record(state, {
  ...baseAttempt,
  itemId: voiceOffInteraction.itemId,
  sessionId: session1.id,
  voice: voiceSample,
});
assert.equal(voiceOffState.attempts.at(-1)?.voice, undefined);

const duplicateSessionIds: ExerciseBlueprint = {
  ...blueprint,
  sessions: [blueprint.sessions[0], { ...blueprint.sessions[1], id: blueprint.sessions[0].id }],
};
assert.throws(() => repository.validateBlueprint(duplicateSessionIds), /Duplicate or empty lesson session id/);

const emptySession: ExerciseBlueprint = {
  ...blueprint,
  sessions: [{ ...session1, interactionCount: 0, interactions: [] }],
};
assert.throws(() => repository.validateBlueprint(emptySession), /Empty lesson session blocked/);

const invalidOrder: ExerciseBlueprint = {
  ...blueprint,
  sessions: [{
    ...session1,
    interactions: session1.interactions.map((interaction, index) =>
      index === 0 ? { ...interaction, order: 2 } : interaction
    ),
  }],
};
assert.throws(() => repository.validateBlueprint(invalidOrder), /Invalid interaction order/);

const invalidMode = {
  ...blueprint,
  sessions: [{
    ...session1,
    interactions: session1.interactions.map((interaction, index) =>
      index === 0 ? { ...interaction, mode: "unsupported_mode" } : interaction
    ),
  }],
} as unknown as ExerciseBlueprint;
assert.throws(() => repository.validateBlueprint(invalidMode), /Unsupported interaction mode/);

const invalidPrecision = {
  ...blueprint,
  sessions: [{
    ...session1,
    interactions: session1.interactions.map((interaction, index) =>
      index === 0 ? { ...interaction, precisionRequired: false } : interaction
    ),
  }],
} as unknown as ExerciseBlueprint;
assert.throws(() => repository.validateBlueprint(invalidPrecision), /Precision must remain required/);

const invalidTiming = {
  ...blueprint,
  sessions: [{
    ...session1,
    interactions: session1.interactions.map((interaction, index) =>
      index === 0 ? { ...interaction, timing: "visible" } : interaction
    ),
  }],
} as unknown as ExerciseBlueprint;
assert.throws(() => repository.validateBlueprint(invalidTiming), /Invalid timing policy/);

const invalidVoice = {
  ...blueprint,
  sessions: [{
    ...session1,
    interactions: session1.interactions.map((interaction, index) =>
      index === 0 ? { ...interaction, voice: "required" } : interaction
    ),
  }],
} as unknown as ExerciseBlueprint;
assert.throws(() => repository.validateBlueprint(invalidVoice), /Invalid voice policy/);

const invalidArabicSourcePolicy = {
  ...blueprint,
  sessions: [{
    ...session1,
    interactions: session1.interactions.map((interaction, index) =>
      index === 0 ? { ...interaction, visibleArabicComesFromManifestOnly: false } : interaction
    ),
  }],
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
