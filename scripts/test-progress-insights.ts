import assert from "node:assert/strict";
import { createInitialLearnerState } from "../src/learning/mastery";
import { accuracyPercent, recentAccuracyPercent } from "../src/learning/progressInsights";

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

console.log("Progress insight precision metric tests passed.");
