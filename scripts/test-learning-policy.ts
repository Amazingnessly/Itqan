import assert from "node:assert/strict";
import { createInitialLearnerState, deriveSkillState, isCategoryUnlocked } from "../src/learning/mastery";
import { buildReviewPlan } from "../src/learning/reviewPlan";
import type { AttemptRecord, ExerciseCategory, LearnerState } from "../src/learning/types";

function attempt(category: ExerciseCategory, sessionId: string, attemptedAt: string, outcome: AttemptRecord["outcome"] = "correct", index = 0): AttemptRecord {
  return { itemId: `${category}-${sessionId}-${index}`, category, sessionId, attemptedAt, outcome };
}

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

run("only reading units are unlocked for a new learner", () => {
  const state = createInitialLearnerState();
  assert.equal(isCategoryUnlocked("reading_units", state), true);
  assert.equal(isCategoryUnlocked("vowels_sukun", state), false);
});

run("the next category requires mastery or excellence, not consolidation", () => {
  const state = createInitialLearnerState();
  state.skills.reading_units = { ...state.skills.reading_units, level: "consolidation" };
  assert.equal(isCategoryUnlocked("vowels_sukun", state), false);
  state.skills.reading_units = { ...state.skills.reading_units, level: "mastery" };
  assert.equal(isCategoryUnlocked("vowels_sukun", state), true);
});

run("a delayed success clears the scheduled stability review", () => {
  const first = new Date("2026-08-24T08:00:00.000Z");
  const later = new Date(first.getTime() + 13 * 60 * 60 * 1000);
  const oneSuccess = deriveSkillState("reading_units", [attempt("reading_units", "s1", first.toISOString())]);
  assert.equal(oneSuccess.delayedCheckPassed, false);
  assert.equal(oneSuccess.nextReviewAt, new Date(first.getTime() + 12 * 60 * 60 * 1000).toISOString());

  const delayed = deriveSkillState("reading_units", [
    attempt("reading_units", "s1", first.toISOString()),
    attempt("reading_units", "s2", later.toISOString()),
  ]);
  assert.equal(delayed.delayedCheckPassed, true);
  assert.equal(delayed.nextReviewAt, undefined);
});

run("mastery requires multiple contexts and a delayed check", () => {
  const base = new Date("2026-08-20T08:00:00.000Z");
  const attempts: AttemptRecord[] = [attempt("reading_units", "s1", base.toISOString(), "correct", 0)];
  const delayedStart = base.getTime() + 13 * 60 * 60 * 1000;
  for (let i = 1; i < 60; i += 1) {
    attempts.push(
      attempt(
        "reading_units",
        `s${(i % 3) + 1}`,
        new Date(delayedStart + i * 60 * 1000).toISOString(),
        "correct",
        i,
      ),
    );
  }
  const skill = deriveSkillState("reading_units", attempts);
  assert.equal(skill.stableAcrossContexts, true);
  assert.equal(skill.delayedCheckPassed, true);
  assert.equal(skill.level, "mastery");

  const singleContext = attempts.map((record) => ({ ...record, sessionId: "single" }));
  assert.notEqual(deriveSkillState("reading_units", singleContext).level, "mastery");
});

run("review planning cannot surface a locked category", () => {
  const state = createInitialLearnerState();
  state.skills.reading_units = { ...state.skills.reading_units, level: "mastery" };
  state.skills.vowels_sukun = { ...state.skills.vowels_sukun, level: "progression" };
  state.attempts = Array.from({ length: 8 }, (_, i) => attempt("shaddah", "locked", new Date(2026, 7, 24, i).toISOString(), "incorrect", i));
  const plan = buildReviewPlan(state, new Date("2026-08-24T20:00:00.000Z"));
  assert.notEqual(plan.category, "shaddah");
});

run("a due delayed review is selected among unlocked skills", () => {
  const state = createInitialLearnerState();
  state.skills.reading_units = { ...state.skills.reading_units, level: "mastery", stableAcrossContexts: true, delayedCheckPassed: true };
  state.skills.vowels_sukun = {
    ...state.skills.vowels_sukun,
    level: "progression",
    stableAcrossContexts: true,
    nextReviewAt: "2026-08-24T08:00:00.000Z",
  };
  const plan = buildReviewPlan(state, new Date("2026-08-24T20:00:00.000Z"));
  assert.equal(plan.category, "vowels_sukun");
  assert.equal(plan.dueNow, true);
});

console.log("Learning policy tests passed.");
