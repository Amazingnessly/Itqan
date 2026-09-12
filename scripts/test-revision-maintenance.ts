import assert from "node:assert/strict";
import { CATEGORY_ORDER } from "../src/learning/categoryCatalog";
import { createInitialLearnerState } from "../src/learning/mastery";
import { buildReviewPlan } from "../src/learning/reviewPlan";
import { rankRevisionPriorities } from "../src/learning/revision";
import type { ExerciseCategory } from "../src/learning/types";

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

console.log("Maintenance review recency tests passed.");
