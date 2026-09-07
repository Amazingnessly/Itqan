import assert from "node:assert/strict";
import { createInitialLearnerState, deriveSkillState } from "../src/learning/mastery";
import { rankRevisionPriorities } from "../src/learning/revision";
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

const failedExtraContexts = [attempt("failed-session-2", "incorrect", 22), attempt("failed-session-3", "incorrect", 23)];
assert.equal(deriveSkillState("reading_units", [...scoredInOneContext, ...failedExtraContexts]).stableAcrossContexts, false);

const scoredAcrossContexts = scoredInOneContext.map((record, index) => ({ ...record, sessionId: `scored-session-${(index % 3) + 1}` }));
assert.equal(deriveSkillState("reading_units", scoredAcrossContexts).stableAcrossContexts, true);

const chronological = [
  ...Array.from({ length: 20 }, (_, index) => attempt(`context-${(index % 3) + 1}`, "correct", index)),
  attempt("context-1", "incorrect", 20),
];
const reordered = [chronological.at(-1)!, ...chronological.slice(0, -1)];
const chronologicalSkill = deriveSkillState("reading_units", chronological);
const reorderedSkill = deriveSkillState("reading_units", reordered);
assert.equal(reorderedSkill.recentAccuracy, chronologicalSkill.recentAccuracy);
assert.equal(reorderedSkill.lastPracticedAt, chronologicalSkill.lastPracticedAt);
assert.equal(reorderedSkill.level, chronologicalSkill.level);

const reviewState = createInitialLearnerState();
reviewState.skills.reading_units = { ...reviewState.skills.reading_units, level: "discovery", stableAcrossContexts: false };
reviewState.skills.vowels_sukun = {
  ...reviewState.skills.vowels_sukun,
  level: "excellence",
  stableAcrossContexts: true,
  nextReviewAt: "2026-08-24T08:00:00.000Z",
};
const priorities = rankRevisionPriorities(reviewState, new Date("2026-08-24T20:00:00.000Z"));
assert.equal(priorities[0].category, "vowels_sukun");
assert.equal(priorities[0].reason, "review_due");

console.log("Mastery stability safety tests passed.");
