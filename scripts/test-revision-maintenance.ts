import assert from "node:assert/strict";
import { CATEGORY_ORDER } from "../src/learning/categoryCatalog";
import { createInitialLearnerState } from "../src/learning/mastery";
import { buildReviewPlan } from "../src/learning/reviewPlan";
import { rankRevisionPriorities } from "../src/learning/revision";
import type { AttemptRecord, ExerciseCategory } from "../src/learning/types";

const state = createInitialLearnerState();
const practicedAt: Record<ExerciseCategory, string> = {
  reading_units: "2026-09-06T08:00:00.000Z",
  vowels_sukun: "2026-09-01T08:00:00.000Z",
  shaddah: "2026-09-02T08:00:00.000Z",
  article_al: "2026-09-03T08:00:00.000Z",
  linking: "2026-09-04T08:00:00.000Z",
  fluent_reading: "2026-09-05T08:00:00.000Z",
};

for (const category of CATEGORY_ORDER) {
  state.skills[category] = {
    ...state.skills[category],
    level: "mastery",
    totalAttempts: 60,
    correctAttempts: 60,
    recentAccuracy: 1,
    stableAcrossContexts: true,
    delayedCheckPassed: true,
    lastPracticedAt: practicedAt[category],
    nextReviewAt: undefined,
  };
}

const now = new Date("2026-09-12T12:00:00.000Z");
let ranked = rankRevisionPriorities(state, now);
assert.equal(ranked[0].reason, "maintenance");
assert.equal(ranked[0].category, "vowels_sukun");
assert.equal(buildReviewPlan(state, now).category, "vowels_sukun");

state.skills.vowels_sukun = {
  ...state.skills.vowels_sukun,
  lastPracticedAt: "2026-09-07T08:00:00.000Z",
};
ranked = rankRevisionPriorities(state, now);
assert.equal(ranked[0].reason, "maintenance");
assert.equal(ranked[0].category, "shaddah");
assert.equal(buildReviewPlan(state, now).category, "shaddah");

state.skills.article_al = {
  ...state.skills.article_al,
  nextReviewAt: "2026-09-10T08:00:00.000Z",
};
ranked = rankRevisionPriorities(state, now);
assert.equal(ranked[0].reason, "review_due");
assert.equal(ranked[0].category, "article_al");
const duePlan = buildReviewPlan(state, now);
assert.equal(duePlan.category, "article_al");
assert.equal(duePlan.dueNow, true);
assert.equal(duePlan.priorityKind, "review_due");

const newLearnerPlan = buildReviewPlan(createInitialLearnerState(), now);
assert.equal(newLearnerPlan.category, "reading_units");
assert.equal(newLearnerPlan.priorityKind, "low_stability");
assert.equal(newLearnerPlan.targetSessionId, "UNITS-B01-S01");

const precisionState = createInitialLearnerState();
precisionState.skills.reading_units = {
  ...precisionState.skills.reading_units,
  level: "progression",
  totalAttempts: 30,
  correctAttempts: 28,
  recentAccuracy: 0.9,
  stableAcrossContexts: true,
  delayedCheckPassed: true,
  lastPracticedAt: "2026-09-11T08:00:00.000Z",
  nextReviewAt: undefined,
};
const precisionPriority = rankRevisionPriorities(precisionState, now)
  .find((priority) => priority.category === "reading_units");
assert.equal(precisionPriority?.reason, "low_stability");
const precisionPlan = buildReviewPlan(precisionState, now);
assert.equal(precisionPlan.category, "reading_units");
assert.equal(precisionPlan.priorityKind, "low_stability");
assert.match(precisionPlan.reason, /précision.*stabiliser/i);
assert.equal(precisionPlan.targetSessionId, "UNITS-B01-S01");

const contextState = createInitialLearnerState();
contextState.skills.reading_units = {
  ...contextState.skills.reading_units,
  level: "progression",
  totalAttempts: 30,
  correctAttempts: 30,
  recentAccuracy: 1,
  stableAcrossContexts: false,
  delayedCheckPassed: true,
  lastPracticedAt: "2026-09-10T08:29:00.000Z",
  nextReviewAt: undefined,
};
contextState.attempts = Array.from({ length: 30 }, (_, index): AttemptRecord => ({
  itemId: `dominant-${index}`,
  category: "reading_units",
  sessionId: "UNITS-B01-S01",
  attemptedAt: new Date(Date.UTC(2026, 8, 10, 8, index)).toISOString(),
  outcome: "correct",
}));

let contextPlan = buildReviewPlan(contextState, now);
assert.equal(contextPlan.category, "reading_units");
assert.equal(contextPlan.targetSessionId, "UNITS-B01-S02");

contextState.attempts.push(...Array.from({ length: 10 }, (_, index): AttemptRecord => ({
  itemId: `secondary-${index}`,
  category: "reading_units",
  sessionId: "UNITS-B01-S02",
  attemptedAt: new Date(Date.UTC(2026, 8, 11, 8, index)).toISOString(),
  outcome: "correct",
})));
contextState.skills.reading_units = {
  ...contextState.skills.reading_units,
  totalAttempts: 40,
  correctAttempts: 40,
  lastPracticedAt: "2026-09-11T08:09:00.000Z",
};
contextPlan = buildReviewPlan(contextState, now);
assert.equal(contextPlan.category, "reading_units");
assert.equal(contextPlan.targetSessionId, "UNITS-B01-S03");

const singleErrorState = createInitialLearnerState();
singleErrorState.attempts = [{
  itemId: "error-1",
  category: "reading_units",
  sessionId: "UNITS-B01-S01",
  attemptedAt: "2026-09-12T10:00:00.000Z",
  outcome: "incorrect",
}];
const singleErrorPlan = buildReviewPlan(singleErrorState, now);
assert.equal(singleErrorPlan.category, "reading_units");
assert.equal(singleErrorPlan.errorCount, 1);
assert.equal(singleErrorPlan.priorityKind, "low_stability");

const doubleErrorState = createInitialLearnerState();
doubleErrorState.attempts = [
  {
    itemId: "error-1",
    category: "reading_units",
    sessionId: "UNITS-B01-S01",
    attemptedAt: "2026-09-12T09:00:00.000Z",
    outcome: "incorrect",
  },
  {
    itemId: "error-2",
    category: "reading_units",
    sessionId: "UNITS-B01-S01",
    attemptedAt: "2026-09-12T10:00:00.000Z",
    outcome: "incorrect",
  },
];
const doubleErrorPlan = buildReviewPlan(doubleErrorState, now);
assert.equal(doubleErrorPlan.category, "reading_units");
assert.equal(doubleErrorPlan.errorCount, 2);
assert.equal(doubleErrorPlan.priorityKind, "recent_errors");
assert.equal(doubleErrorPlan.targetSessionId, "UNITS-B01-S01");

console.log("Maintenance review, precision stability, urgency alignment and context targeting tests passed.");
