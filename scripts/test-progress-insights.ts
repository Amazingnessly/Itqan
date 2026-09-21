import assert from "node:assert/strict";
import { createInitialLearnerState } from "../src/learning/mastery";
import { accuracyPercent, learningStageProgress, recentAccuracyPercent } from "../src/learning/progressInsights";

const state = createInitialLearnerState();
state.skills.reading_units = {
  ...state.skills.reading_units,
  totalAttempts: 100,
  correctAttempts: 99,
  recentAccuracy: 0.9,
};

assert.equal(accuracyPercent(state, "reading_units"), 99);
assert.equal(recentAccuracyPercent(state, "reading_units"), 90);

state.skills.reading_units = {
  ...state.skills.reading_units,
  totalAttempts: 0,
  correctAttempts: 0,
  recentAccuracy: 0,
};

assert.equal(accuracyPercent(state, "reading_units"), 0);
assert.equal(recentAccuracyPercent(state, "reading_units"), 0);

const stages = learningStageProgress(state);
assert.equal(stages.length, 7);
assert.deepEqual(stages.map((stage) => stage.id), [
  "reading_units",
  "vowels_sukun",
  "article_qamariyyah",
  "shaddah",
  "article_shamsiyyah",
  "linking",
  "fluent_reading",
]);
assert.equal(stages[0].unlocked, true);
assert.ok(stages.slice(1).every((stage) => !stage.unlocked));
assert.notEqual(stages[2].id, stages[4].id);

console.log("Progress insight precision metric tests passed.");
