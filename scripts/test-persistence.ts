import assert from "node:assert/strict";
import {
  availableSessionItemIdsForActiveLesson,
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
      reading_units: { ...initial.skills.reading_units, level: "excellence" as const },
    },
  };
  const sanitized = sanitizeLearnerState(forged);
  assert.ok(sanitized);
  assert.equal(sanitized.skills.reading_units.level, "discovery");
}

{
  const state = createInitialLearnerState();
  state.attempts = [attempt()];
  const sanitized = sanitizeLearnerState(state);
  assert.ok(sanitized);
  assert.equal(sanitized.attempts.length, 1);
  assert.equal(sanitized.skills.reading_units.totalAttempts, 1);
}

{
  const state = createInitialLearnerState();
  state.attempts = [attempt({ itemId: "not-controlled" })];
  const sanitized = sanitizeLearnerState(state);
  assert.ok(sanitized);
  assert.equal(sanitized.attempts.length, 0);
  assert.equal(sanitized.skills.reading_units.totalAttempts, 0);
}

{
  const storage = new Map<string, string>();
  const localStorage = {
    getItem(key: string) { return storage.get(key) ?? null; },
    setItem(key: string, value: string) { storage.set(key, value); },
    removeItem(key: string) { storage.delete(key); },
  };
  Object.defineProperty(globalThis, "window", { value: { localStorage }, configurable: true });
  saveLearnerState(initial);
  assert.ok(storage.size > 0);
  delete (globalThis as { window?: unknown }).window;
}

{
  const storage = new Map<string, string>();
  const localStorage = {
    getItem(key: string) { return storage.get(key) ?? null; },
    setItem(key: string, value: string) { storage.set(key, value); },
    removeItem(key: string) { storage.delete(key); },
  };
  Object.defineProperty(globalThis, "window", { value: { localStorage }, configurable: true });
  saveSessionCursor({ category: "reading_units", sessionId: "UNITS-B01-S01", interactionIndex: 3 });
  assert.ok(storage.size > 0);
  clearSessionCursor();
  assert.equal(storage.size, 0);
  delete (globalThis as { window?: unknown }).window;
}

{
  const state = createInitialLearnerState();
  const completed = markSessionCompleted(state, "UNITS-B01-S01");
  assert.equal(completed.completedSessionIds.includes("UNITS-B01-S01"), true);
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
  const sessionItems = [...availableSessionItemIdsForActiveLesson("reading_units", "UNITS-B01-S01")];
  assert.equal(sessionItems.length, 10);
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
    sessionId: "UNITS-B01-S02",
    attemptedAt: "2026-08-24T08:09:00.000Z",
  })];
  assert.equal(completedSessionIdsFromAuthorizedAttempts(forgedOtherSession).includes("UNITS-B01-S01"), false);
  assert.equal(sessionResumeIndexFromAuthorizedAttempts("reading_units", "UNITS-B01-S01", forgedOtherSession), 9);
}

console.log("Persistence safety tests passed.");
