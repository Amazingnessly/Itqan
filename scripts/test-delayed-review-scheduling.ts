import assert from "node:assert/strict";
import { createInitialLearnerState, deriveSkillState } from "../src/learning/mastery";
import { buildReviewPlan } from "../src/learning/reviewPlan";
import type { AttemptRecord } from "../src/learning/types";

function correctAttempt(itemId: string, sessionId: string, attemptedAt: string): AttemptRecord {
  return {
    itemId,
    category: "reading_units",
    sessionId,
    attemptedAt,
    outcome: "correct",
  };
}

const firstAt = "2026-09-12T08:00:00.000Z";
const intermediateAt = "2026-09-12T19:00:00.000Z";
const shiftedReviewAt = "2026-09-13T07:00:00.000Z";
const attempts = [
  correctAttempt("first", "UNITS-B01-S01", firstAt),
  correctAttempt("intermediate", "UNITS-B01-S02", intermediateAt),
];

const skill = deriveSkillState("reading_units", attempts);
assert.equal(skill.delayedCheckPassed, false);
assert.equal(skill.nextReviewAt, shiftedReviewAt);

const state = createInitialLearnerState();
state.attempts = attempts;
state.skills.reading_units = skill;

const oldDuePlan = buildReviewPlan(state, new Date("2026-09-12T20:00:00.000Z"));
assert.equal(oldDuePlan.priorityKind, "low_stability");
assert.equal(oldDuePlan.dueNow, false);

const shiftedDuePlan = buildReviewPlan(state, new Date(shiftedReviewAt));
assert.equal(shiftedDuePlan.priorityKind, "review_due");
assert.equal(shiftedDuePlan.dueNow, true);
assert.equal(shiftedDuePlan.targetSessionId, "UNITS-B01-S02");

const delayed = deriveSkillState("reading_units", [
  ...attempts,
  correctAttempt("delayed-check", "UNITS-B01-S03", shiftedReviewAt),
]);
assert.equal(delayed.delayedCheckPassed, true);
assert.equal(delayed.nextReviewAt, undefined);

console.log("Delayed review scheduling stays aligned with the latest successful practice.");
