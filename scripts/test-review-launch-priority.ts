import assert from "node:assert/strict";
import fs from "node:fs";
import { createInitialLearnerState, deriveSkillState } from "../src/learning/mastery";
import { buildReviewLaunchTarget, buildReviewPlan } from "../src/learning/reviewPlan";
import { mostRecentIncompleteLessonTarget } from "../src/learning/sessionCatalog";
import type { AttemptRecord, ExerciseBlueprint, ExerciseCategory } from "../src/learning/types";

function loadBlueprint(path: string): ExerciseBlueprint {
  return JSON.parse(fs.readFileSync(path, "utf8")) as ExerciseBlueprint;
}

function controlledAttempt(
  category: ExerciseCategory,
  blueprint: ExerciseBlueprint,
  sessionIndex: number,
  interactionIndex: number,
  attemptedAt: string,
  outcome: AttemptRecord["outcome"],
): AttemptRecord {
  const session = blueprint.sessions[sessionIndex];
  const interaction = session?.interactions[interactionIndex];
  assert.ok(session && interaction);
  return {
    category,
    sessionId: session.id,
    itemId: interaction.itemId,
    attemptedAt,
    outcome,
  };
}

const readingBlueprint = loadBlueprint("public/content/blueprints/units-batch01.json");
const vowelsBlueprint = loadBlueprint("public/content/blueprints/vowels_sukun-batch02.json");

{
  const state = createInitialLearnerState();
  const partialReading = controlledAttempt(
    "reading_units",
    readingBlueprint,
    0,
    0,
    "2026-08-24T08:00:00.000Z",
    "correct",
  );
  state.attempts = [partialReading];
  state.skills.reading_units = deriveSkillState("reading_units", state.attempts);

  const plan = buildReviewPlan(state, new Date("2026-08-24T09:00:00.000Z"));
  assert.equal(plan.priorityKind, "low_stability");
  assert.equal(plan.category, "reading_units");
  assert.equal(plan.targetSessionId, readingBlueprint.sessions[1].id);

  const launch = buildReviewLaunchTarget(state, plan);
  assert.equal(launch.kind, "incomplete_session");
  assert.equal(launch.category, "reading_units");
  assert.equal(launch.targetSessionId, readingBlueprint.sessions[0].id);
}

{
  const state = createInitialLearnerState();
  state.skills.reading_units = {
    ...state.skills.reading_units,
    level: "mastery",
    totalAttempts: 60,
    correctAttempts: 60,
    recentAccuracy: 1,
    stableAcrossContexts: true,
    delayedCheckPassed: true,
  };

  const vowelsErrorS1 = controlledAttempt(
    "vowels_sukun",
    vowelsBlueprint,
    0,
    0,
    "2026-08-24T08:00:00.000Z",
    "incorrect",
  );
  const vowelsErrorS2 = controlledAttempt(
    "vowels_sukun",
    vowelsBlueprint,
    1,
    0,
    "2026-08-24T09:00:00.000Z",
    "incorrect",
  );
  const laterReadingMaintenance = controlledAttempt(
    "reading_units",
    readingBlueprint,
    0,
    0,
    "2026-08-24T10:00:00.000Z",
    "correct",
  );
  state.attempts = [vowelsErrorS1, vowelsErrorS2, laterReadingMaintenance];
  state.skills.vowels_sukun = deriveSkillState("vowels_sukun", state.attempts);

  const incomplete = mostRecentIncompleteLessonTarget(
    ["reading_units", "vowels_sukun"],
    state.attempts,
  );
  assert.equal(incomplete?.category, "reading_units");
  assert.equal(incomplete?.sessionId, readingBlueprint.sessions[0].id);

  const plan = buildReviewPlan(state, new Date("2026-08-24T11:00:00.000Z"));
  assert.equal(plan.priorityKind, "recent_errors");
  assert.equal(plan.category, "vowels_sukun");
  assert.equal(plan.targetSessionId, vowelsBlueprint.sessions[1].id);

  const launch = buildReviewLaunchTarget(state, plan);
  assert.equal(launch.kind, "urgent_review");
  assert.equal(launch.category, "vowels_sukun");
  assert.equal(launch.targetSessionId, vowelsBlueprint.sessions[1].id);
}

console.log("Review launch priority tests passed.");
