import assert from "node:assert/strict";
import {
  currentIncompleteSessionReadingMs,
  currentIncompleteSessionRetryCount,
} from "../src/learning/sessionProgress";
import type { AttemptRecord } from "../src/learning/types";

const category = "reading_units" as const;
const sessionId = "UNITS-B01-S01";
const interactionCount = 3;

function attempt(
  itemId: string,
  outcome: AttemptRecord["outcome"],
  minute: number,
  readingMs?: number,
): AttemptRecord {
  return {
    itemId,
    category,
    sessionId,
    attemptedAt: new Date(Date.UTC(2026, 8, 14, 8, minute)).toISOString(),
    outcome,
    ...(readingMs === undefined
      ? {}
      : { timing: { preparationMs: 0, readingMs, totalMs: readingMs } }),
  };
}

const completedCycle = [
  attempt("item-1", "incorrect", 0, 9_000),
  attempt("item-1", "correct", 1, 1_000),
  attempt("item-2", "incorrect", 2, 8_000),
  attempt("item-2", "correct", 3, 2_000),
  attempt("item-3", "correct", 4, 3_000),
];
assert.equal(currentIncompleteSessionRetryCount(completedCycle, category, sessionId, interactionCount), 0);
assert.equal(currentIncompleteSessionReadingMs(completedCycle, category, sessionId, interactionCount), 0);

const interruptedCycle = [
  ...completedCycle,
  attempt("item-1", "incorrect", 5, 7_000),
  attempt("item-1", "correct", 6, 1_500),
  attempt("item-2", "incorrect", 7, 6_000),
];
assert.equal(currentIncompleteSessionRetryCount(interruptedCycle, category, sessionId, interactionCount), 2);
assert.equal(currentIncompleteSessionReadingMs(interruptedCycle, category, sessionId, interactionCount), 1_500);

const continuedCycle = [
  ...interruptedCycle,
  attempt("item-2", "correct", 8, 2_500),
];
assert.equal(currentIncompleteSessionReadingMs(continuedCycle, category, sessionId, interactionCount), 4_000);

const interleavedOtherSession: AttemptRecord = {
  itemId: "other-item",
  category,
  sessionId: "UNITS-B01-S02",
  attemptedAt: new Date(Date.UTC(2026, 8, 14, 8, 9)).toISOString(),
  outcome: "correct",
  timing: { preparationMs: 0, readingMs: 99_000, totalMs: 99_000 },
};
assert.equal(
  currentIncompleteSessionRetryCount(
    [...interruptedCycle, interleavedOtherSession],
    category,
    sessionId,
    interactionCount,
  ),
  2,
);
assert.equal(
  currentIncompleteSessionReadingMs(
    [...continuedCycle, interleavedOtherSession],
    category,
    sessionId,
    interactionCount,
  ),
  4_000,
);

assert.equal(currentIncompleteSessionRetryCount(interruptedCycle, category, sessionId, 0), 0);
assert.equal(currentIncompleteSessionReadingMs(interruptedCycle, category, sessionId, 0), 0);

console.log("Resumed session retry and reading-time summary checks passed.");
