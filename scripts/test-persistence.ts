import assert from "node:assert/strict";
import { createInitialLearnerState } from "../src/learning/mastery";
import { clearSessionCursor, sanitizeLearnerState, saveLearnerState, saveSessionCursor } from "../src/learning/persistence";
import { markSessionCompleted } from "../src/learning/sessionProgress";
import type { AttemptRecord } from "../src/learning/types";

function attempt(overrides: Partial<AttemptRecord> = {}): AttemptRecord {
  return {
    itemId: "item-1",
    category: "reading_units",
    sessionId: "session-1",
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
      attempt({ itemId: "item-2", outcome: "skipped" }),
    ],
    skills: {},
  }, now);
  assert.ok(sanitized);
  assert.equal(sanitized.xp, 2);
  assert.equal(sanitized.streakDays, 1);
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
  assert.deepEqual(markSessionCompleted("session-1"), ["session-1"]);
}

console.log("Persistence safety tests passed.");
