import assert from "node:assert/strict";
import { createInitialLearnerState } from "../src/learning/mastery";
import { sanitizeLearnerState } from "../src/learning/persistence";
import type { AttemptRecord, TimingSample } from "../src/learning/types";

const initial = createInitialLearnerState();

function stateWithTiming(timing: TimingSample) {
  const attempt: AttemptRecord = {
    itemId: "S110-P003-001",
    category: "reading_units",
    sessionId: "UNITS-B01-S01",
    attemptedAt: "2026-08-24T08:00:00.000Z",
    outcome: "correct",
    timing,
  };
  return { ...initial, attempts: [attempt] };
}

assert.ok(sanitizeLearnerState(stateWithTiming({ preparationMs: 10, readingMs: 20, totalMs: 30, pauseCount: 0, retryCount: 1 })));
assert.equal(sanitizeLearnerState(stateWithTiming({ preparationMs: 10, readingMs: 31, totalMs: 30 })), null);
assert.equal(sanitizeLearnerState(stateWithTiming({ preparationMs: 20, readingMs: 20, totalMs: 30 })), null);
assert.equal(sanitizeLearnerState(stateWithTiming({ preparationMs: 31, readingMs: 0, totalMs: 30 })), null);
assert.equal(sanitizeLearnerState(stateWithTiming({ preparationMs: 0, readingMs: 20, totalMs: 20, pauseCount: 1.5 })), null);
assert.equal(sanitizeLearnerState(stateWithTiming({ preparationMs: 0, readingMs: 20, totalMs: 20, retryCount: 0.25 })), null);

console.log("Persisted timing observation safety checks passed.");
