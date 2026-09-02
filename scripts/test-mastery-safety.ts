import assert from "node:assert/strict";
import { deriveSkillState } from "../src/learning/mastery";
import type { AttemptRecord } from "../src/learning/types";

function attempt(sessionId: string, outcome: AttemptRecord["outcome"], index: number): AttemptRecord {
  return {
    itemId: `item-${index}`,
    category: "reading_units",
    sessionId,
    attemptedAt: new Date(Date.UTC(2026, 7, 24, 8, index)).toISOString(),
    outcome,
  };
}

const scoredInOneContext = Array.from({ length: 12 }, (_, index) => attempt("scored-session", "correct", index));
const skippedContexts = [attempt("skip-session-2", "skipped", 20), attempt("skip-session-3", "skipped", 21)];
const withSkippedContexts = deriveSkillState("reading_units", [...scoredInOneContext, ...skippedContexts]);
assert.equal(withSkippedContexts.stableAcrossContexts, false);
assert.equal(withSkippedContexts.totalAttempts, 12);

const scoredAcrossContexts = scoredInOneContext.map((record, index) => ({ ...record, sessionId: `scored-session-${(index % 3) + 1}` }));
assert.equal(deriveSkillState("reading_units", scoredAcrossContexts).stableAcrossContexts, true);

console.log("Mastery stability safety tests passed.");
