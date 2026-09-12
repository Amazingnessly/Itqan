import assert from "node:assert/strict";
import {
  completedSessionIdsFromAuthorizedAttempts,
  sessionResumeIndexFromAuthorizedAttempts,
} from "../src/learning/attemptRegistry.generated";
import { createInitialLearnerState } from "../src/learning/mastery";
import { clearSessionCursor, sanitizeLearnerState, saveLearnerState, saveSessionCursor } from "../src/learning/persistence";
import { markSessionCompleted } from "../src/learning/sessionProgress";
import type { AttemptRecord } from "../src/learning/types";

function attempt(overrides: Partial<AttemptRecord> = {}): AttemptRecord {
  return {
    itemId: "S110-P003-001",
    category: "reading_units",
    sessionId: "UNITS-B01-S01",
    attemptedAt: "2026-08-24T08:00:00.000Z",
    outcome: "correct",
    ...overrides,
  };
}

const initial = createInitialLearnerState();

{
  const sanitized = sanitizeLearnerState(initial);
  assert.ok(sanitized);
  assert.equal(sanitized.skills.reading_units.level, "discovery");
  assert.equal(sanitized.skills.vowels_sukun.level, "discovery");
}

{
  const forged = {
    ...initial,
    skills: {
      ...initial.skills,
      reading_units: { ...initial.skills.reading_units, level: "excellence" },
    },
  };
  const sanitized = sanitizeLearnerState(forged);
  assert.ok(sanitized);
  assert.equal(sanitized.skills.reading_units.level, "discovery");
}

{
  const now = new Date("2026-08-24T12:00:00.000Z");
  const valid = sanitizeLearnerState({
    version: 1,
    xp: 999999,
    streakDays: 999999,
    attempts: [attempt()],
    skills: {},
  }, now);
  assert.ok(valid);
  assert.equal(valid.attempts.length, 1);
  assert.equal(valid.skills.reading_units.totalAttempts, 1);
  assert.equal(valid.skills.reading_units.correctAttempts, 1);
  assert.equal(valid.xp, 5);
  assert.equal(valid.streakDays, 1);
}

{
  const now = new Date("2026-08-24T12:00:00.000Z");
  const sanitized = sanitizeLearnerState({
    version: 1,
    xp: -1,
    streakDays: "forged",
    attempts: [
      attempt({ outcome: "incorrect" }),
      attempt({ outcome: "skipped" }),
    ],
    skills: {},
  }, now);
  assert.ok(sanitized);
  assert.equal(sanitized.xp, 2);
  assert.equal(sanitized.streakDays, 1);
}

{
  const now = new Date("2026-08-24T12:00:00.000Z");
  const sanitized = sanitizeLearnerState({
    version: 1,
    attempts: [
      attempt(),
      attempt({ itemId: "forged-item", sessionId: "forged-session" }),
    ],
  }, now);
  assert.ok(sanitized);
  assert.equal(sanitized.attempts.length, 1);
  assert.equal(sanitized.attempts[0].itemId, "S110-P003-001");
  assert.equal(sanitized.skills.reading_units.totalAttempts, 1);
  assert.equal(sanitized.xp, 5);
}

{
  const now = new Date("2026-08-24T12:00:00.000Z");
  const sanitized = sanitizeLearnerState({
    version: 1,
    attempts: [
      attempt({ itemId: "S110-P003-002", attemptedAt: "2026-08-24T08:00:00.000Z" }),
      attempt({ outcome: "incorrect", attemptedAt: "2026-08-24T08:01:00.000Z" }),
      attempt({ itemId: "S110-P003-002", attemptedAt: "2026-08-24T08:02:00.000Z" }),
      attempt({ attemptedAt: "2026-08-24T08:03:00.000Z" }),
      attempt({ itemId: "S110-P003-002", attemptedAt: "2026-08-24T08:04:00.000Z" }),
    ],
  }, now);
  assert.ok(sanitized);
  assert.deepEqual(
    sanitized.attempts.map((record) => [record.itemId, record.outcome]),
    [
      ["S110-P003-001", "incorrect"],
      ["S110-P003-001", "correct"],
      ["S110-P003-002", "correct"],
    ],
  );
}

{
  const now = new Date("2026-08-24T12:00:00.000Z");
  const nonAllowlistedAttempt = attempt({
    itemId: "S110-P003-011",
    sessionId: "UNITS-B01-S09",
  });
  const sanitized = sanitizeLearnerState({
    version: 1,
    attempts: [nonAllowlistedAttempt],
  }, now);
  assert.ok(sanitized);
  assert.equal(sanitized.attempts.length, 0);
  assert.equal(sanitized.skills.reading_units.totalAttempts, 0);
  assert.equal(sanitized.xp, 0);
  assert.equal(sessionResumeIndexFromAuthorizedAttempts("reading_units", "UNITS-B01-S09", [nonAllowlistedAttempt]), 0);
  assert.equal(completedSessionIdsFromAuthorizedAttempts([nonAllowlistedAttempt]).includes("UNITS-B01-S09"), false);
}

{
  const sessionItems = Array.from({ length: 10 }, (_, index) => `S110-P003-${String(index + 1).padStart(3, "0")}`);
  const partial = sessionItems.slice(0, 9).map((itemId, index) => attempt({
    itemId,
    attemptedAt: new Date(Date.UTC(2026, 7, 24, 8, index)).toISOString(),
  }));
  assert.equal(completedSessionIdsFromAuthorizedAttempts(partial).includes("UNITS-B01-S01"), false);
  assert.equal(sessionResumeIndexFromAuthorizedAttempts("reading_units", "UNITS-B01-S01", partial), 9);

  const complete = [...partial, attempt({
    itemId: sessionItems[9],
    attemptedAt: "2026-08-24T08:09:00.000Z",
  })];
  assert.equal(completedSessionIdsFromAuthorizedAttempts(complete).includes("UNITS-B01-S01"), true);
  assert.equal(sessionResumeIndexFromAuthorizedAttempts("reading_units", "UNITS-B01-S01", complete), 0);

  const wrongOutcome = complete.map((record, index) => index === 9 ? { ...record, outcome: "incorrect" as const } : record);
  assert.equal(completedSessionIdsFromAuthorizedAttempts(wrongOutcome).includes("UNITS-B01-S01"), false);
  assert.equal(sessionResumeIndexFromAuthorizedAttempts("reading_units", "UNITS-B01-S01", wrongOutcome), 9);

  const forgedOtherSession = [...partial, attempt({
    itemId: sessionItems[9],
    sessionId: "forged-session",
    attemptedAt: "2026-08-24T08:09:00.000Z",
  })];
  assert.equal(sessionResumeIndexFromAuthorizedAttempts("reading_units", "UNITS-B01-S01", forgedOtherSession), 9);
}

{
  const timing = { preparationMs: 10, readingMs: 20, totalMs: 30 };
  const voice = { attempted: true, providerScore: 0.8, providerConfidence: 0.7 };
  const optionalVoiceButTimingOff = sanitizeLearnerState({
    version: 1,
    attempts: [attempt({ timing, voice })],
  }, new Date("2026-08-24T12:00:00.000Z"));
  assert.ok(optionalVoiceButTimingOff);
  assert.equal(optionalVoiceButTimingOff.attempts[0].timing, undefined);
  assert.deepEqual(optionalVoiceButTimingOff.attempts[0].voice, voice);

  const voiceOff = sanitizeLearnerState({
    version: 1,
    attempts: [
      attempt(),
      attempt({ itemId: "S110-P003-002", voice, attemptedAt: "2026-08-24T08:01:00.000Z" }),
    ],
  }, new Date("2026-08-24T12:00:00.000Z"));
  assert.ok(voiceOff);
  assert.equal(voiceOff.attempts[1].voice, undefined);
}

{
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
  const prior = stableTuples.map(([sessionId, itemId], index) => attempt({
    sessionId,
    itemId,
    attemptedAt: new Date(Date.UTC(2026, 7, 23, 8, index)).toISOString(),
  }));
  const timing = { preparationMs: 10, readingMs: 20, totalMs: 30 };
  const sanitized = sanitizeLearnerState({
    version: 1,
    attempts: [
      ...prior,
      attempt({
        itemId: "S110-P003-005",
        attemptedAt: "2026-08-24T08:00:00.000Z",
        timing,
      }),
    ],
  }, new Date("2026-08-24T12:00:00.000Z"));
  assert.ok(sanitized);
  assert.equal(sanitized.skills.reading_units.stableAcrossContexts, true);
  assert.equal(sanitized.attempts.at(-1)?.timing, undefined);
}

assert.equal(sanitizeLearnerState({ ...initial, attempts: [{ ...attempt(), category: "unknown" }] }), null);
assert.equal(sanitizeLearnerState({ ...initial, attempts: [{ ...attempt(), attemptedAt: "not-a-date" }] }), null);
assert.equal(sanitizeLearnerState({ ...initial, attempts: [{ ...attempt(), attemptedAt: "2026-08-24T08:00:00Z" }] }), null);
assert.equal(sanitizeLearnerState({ ...initial, attempts: [{ ...attempt(), timing: { preparationMs: 1, readingMs: -2, totalMs: 3 } }] }), null);

{
  const now = new Date("2026-08-24T08:00:00.000Z");
  const withinClockSkew = new Date(now.getTime() + 4 * 60 * 1000).toISOString();
  const forgedFuture = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();
  assert.ok(sanitizeLearnerState({ ...initial, attempts: [attempt({ attemptedAt: withinClockSkew })] }, now));
  assert.equal(sanitizeLearnerState({ ...initial, attempts: [attempt({ attemptedAt: forgedFuture })] }, now), null);
}

{
  const throwingStorage = {
    getItem: () => null,
    setItem: () => { throw new Error("storage unavailable"); },
    removeItem: () => { throw new Error("storage unavailable"); },
    clear: () => undefined,
    key: () => null,
    length: 0,
  } satisfies Storage;
  Object.defineProperty(globalThis, "localStorage", { value: throwingStorage, configurable: true });

  assert.doesNotThrow(() => saveLearnerState(initial));
  assert.doesNotThrow(() => saveSessionCursor("session-1", 2));
  assert.doesNotThrow(() => clearSessionCursor("session-1"));
  assert.deepEqual(markSessionCompleted("session-1"), []);
}

console.log("Persistence safety tests passed.");