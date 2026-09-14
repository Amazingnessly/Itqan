import assert from "node:assert/strict";
import { currentIncompleteSessionRetryCount } from "../src/learning/sessionProgress";
import type { AttemptRecord } from "../src/learning/types";

const category = "reading_units" as const;
const sessionId = "UNITS-B01-S01";
const interactionCount = 3;

function attempt(
  itemId: string,
  outcome: AttemptRecord["outcome"],
  minute: number,
): AttemptRecord {
  return {
    itemId,
    category,
    sessionId,
    attemptedAt: new Date(Date.UTC(2026, 8, 14, 8, minute)).toISOString(),
    outcome,
  };
}

const completedCycle = [
  attempt("item-1", "incorrect", 0),
  attempt("item-1", "correct", 1),
  attempt("item-2", "incorrect", 2),
  attempt("item-2", "correct", 3),
  attempt("item-3", "correct", 4),
];
assert.equal(currentIncompleteSessionRetryCount(completedCycle, category, sessionId, interactionCount), 0);

const interruptedCycle = [
  ...completedCycle,
  attempt("item-1", "incorrect", 5),
  attempt("item-1", "correct", 6),
  attempt("item-2", "incorrect", 7),
];
assert.equal(currentIncompleteSessionRetryCount(interruptedCycle, category, sessionId, interactionCount), 2);

const interleavedOtherSession: AttemptRecord = {
  itemId: "other-item",
  category,
  sessionId: "UNITS-B01-S02",
  attemptedAt: new Date(Date.UTC(2026, 8, 14, 8, 8)).toISOString(),
  outcome: "incorrect",
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

assert.equal(currentIncompleteSessionRetryCount(interruptedCycle, category, sessionId, 0), 0);

console.log("Resumed session retry summary checks passed.");
