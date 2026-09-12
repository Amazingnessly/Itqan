import assert from "node:assert/strict";
import { appendAttempt, createInitialLearnerState, deriveSkillState, hasPrecisionStability } from "../src/learning/mastery";
import { recentErrors } from "../src/learning/progressInsights";
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
assert.equal(hasPrecisionStability(withSkippedContexts), false);

const failedExtraContexts = [attempt("failed-session-2", "incorrect", 22), attempt("failed-session-3", "incorrect", 23)];
assert.equal(deriveSkillState("reading_units", [...scoredInOneContext, ...failedExtraContexts]).stableAcrossContexts, false);

const scoredAcrossContexts = scoredInOneContext.map((record, index) => ({ ...record, sessionId: `scored-session-${(index % 3) + 1}` }));
const preciseAcrossContexts = deriveSkillState("reading_units", scoredAcrossContexts);
assert.equal(preciseAcrossContexts.stableAcrossContexts, true);
assert.equal(hasPrecisionStability(preciseAcrossContexts), true);

const staleContextHistory = [
  ...Array.from({ length: 12 }, (_, index) => attempt(`historical-session-${(index % 3) + 1}`, "correct", index)),
  ...Array.from({ length: 30 }, (_, index) => attempt("recent-single-session", "correct", index + 30)),
];
const staleContextSkill = deriveSkillState("reading_units", staleContextHistory);
assert.equal(staleContextSkill.recentAccuracy, 1);
assert.equal(staleContextSkill.stableAcrossContexts, false);
assert.equal(hasPrecisionStability(staleContextSkill), false);
assert.notEqual(staleContextSkill.level, "mastery");

const refreshedContextHistory = [
  ...Array.from({ length: 30 }, (_, index) => attempt("historical-single-session", "correct", index)),
  ...Array.from({ length: 30 }, (_, index) => attempt(`recent-session-${(index % 3) + 1}`, "correct", index + 30)),
];
const refreshedContextSkill = deriveSkillState("reading_units", refreshedContextHistory);
assert.equal(refreshedContextSkill.stableAcrossContexts, true);
assert.equal(hasPrecisionStability(refreshedContextSkill), true);

const unstablePrecision = deriveSkillState("reading_units", scoredAcrossContexts.map((record, index) => index === 0 ? { ...record, outcome: "incorrect" as const } : record));
assert.equal(unstablePrecision.stableAcrossContexts, true);
assert.ok(unstablePrecision.recentAccuracy < 0.94);
assert.equal(hasPrecisionStability(unstablePrecision), false);

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

const chronologicalState = createInitialLearnerState();
chronologicalState.attempts = chronological;
const reorderedState = createInitialLearnerState();
reorderedState.attempts = reordered;
assert.equal(recentErrors(reorderedState, "reading_units"), recentErrors(chronologicalState, "reading_units"));
assert.deepEqual(
  rankRevisionPriorities(reorderedState, new Date("2026-08-24T20:00:00.000Z")),
  rankRevisionPriorities(chronologicalState, new Date("2026-08-24T20:00:00.000Z")),
);

const correctedState = createInitialLearnerState();
correctedState.attempts = [
  { ...attempt("repair-session", "incorrect", 1), itemId: "repair-item" },
  { ...attempt("repair-session", "incorrect", 2), itemId: "other-item" },
  { ...attempt("repair-session", "correct", 3), itemId: "repair-item" },
];
assert.equal(recentErrors(correctedState, "reading_units"), 1);
assert.equal(rankRevisionPriorities(correctedState, new Date("2026-08-24T20:00:00.000Z"))[0].reason, "low_stability");
correctedState.attempts = [
  ...correctedState.attempts,
  { ...attempt("repair-session", "correct", 4), itemId: "other-item" },
];
assert.equal(recentErrors(correctedState, "reading_units"), 0);

let runtimeState = createInitialLearnerState();
runtimeState = appendAttempt(runtimeState, attempt("runtime-session", "correct", 5));
runtimeState = appendAttempt(runtimeState, attempt("runtime-session", "correct", 1));
assert.equal(runtimeState.attempts[0].attemptedAt, attempt("runtime-session", "correct", 1).attemptedAt);
assert.equal(runtimeState.attempts[1].attemptedAt, attempt("runtime-session", "correct", 5).attemptedAt);

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
