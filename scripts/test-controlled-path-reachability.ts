import assert from "node:assert/strict";
import fs from "node:fs";
import { isSessionAvailableForActiveLesson } from "../src/learning/attemptRegistry.generated";
import { CATEGORY_ORDER } from "../src/learning/categoryCatalog";
import { createInitialLearnerState, isCategoryUnlocked } from "../src/learning/mastery";
import { sanitizeLearnerState } from "../src/learning/persistence";
import { nextSessionId } from "../src/learning/sessionCatalog";
import type { AttemptRecord, ExerciseBlueprint, ExerciseCategory, LearnerState } from "../src/learning/types";

const BLUEPRINTS: Record<ExerciseCategory, string> = {
  reading_units: "public/content/blueprints/units-batch01.json",
  vowels_sukun: "public/content/blueprints/vowels_sukun-batch02.json",
  shaddah: "public/content/blueprints/shaddah-batch02.json",
  article_al: "public/content/blueprints/article_al-batch02.json",
  linking: "public/content/blueprints/linking-batch02.json",
  fluent_reading: "public/content/blueprints/fluent_reading-batch02.json",
};

function loadBlueprint(category: ExerciseCategory): ExerciseBlueprint {
  return JSON.parse(fs.readFileSync(BLUEPRINTS[category], "utf8")) as ExerciseBlueprint;
}

function masteryAttempts(
  category: ExerciseCategory,
  blueprint: ExerciseBlueprint,
  startMs: number,
): { attempts: AttemptRecord[]; endMs: number } {
  const sessions = blueprint.sessions.slice(0, 3);
  assert.equal(sessions.length, 3);
  for (const session of sessions) {
    assert.equal(isSessionAvailableForActiveLesson(category, session.id), true);
  }
  const fourth = blueprint.sessions[3];
  if (fourth) assert.equal(isSessionAvailableForActiveLesson(category, fourth.id), false);

  const attempts: AttemptRecord[] = [];
  const selectedSessions: string[] = [];
  let cursorMs = startMs;
  let delayedGapAdded = false;
  const firstCycleAttemptCount = sessions.reduce((sum, session) => sum + session.interactions.length, 0);

  while (attempts.length < 60) {
    if (!delayedGapAdded && attempts.length >= firstCycleAttemptCount) {
      cursorMs += 13 * 60 * 60 * 1000;
      delayedGapAdded = true;
    }

    const selectedId = nextSessionId(blueprint, attempts);
    assert.ok(selectedId, `${category} should always have an active controlled session.`);
    const session = sessions.find((candidate) => candidate.id === selectedId);
    assert.ok(session, `${category}/${selectedId} must stay inside the active S01-S03 prefix.`);
    selectedSessions.push(selectedId);

    for (const interaction of session.interactions) {
      if (attempts.length >= 60) break;
      attempts.push({
        category,
        sessionId: selectedId,
        itemId: interaction.itemId,
        attemptedAt: new Date(cursorMs).toISOString(),
        outcome: "correct",
      });
      cursorMs += 60_000;
    }
  }

  assert.equal(attempts.length, 60);
  assert.deepEqual(selectedSessions.slice(0, 6), [
    sessions[0].id,
    sessions[1].id,
    sessions[2].id,
    sessions[0].id,
    sessions[1].id,
    sessions[2].id,
  ]);
  assert.equal(new Set(attempts.slice(-30).map((attempt) => attempt.sessionId)).size, 3);
  assert.ok(attempts.every((attempt) => attempt.timing === undefined && attempt.voice === undefined));
  return { attempts, endMs: cursorMs };
}

let state: LearnerState = createInitialLearnerState();
let allAttempts: AttemptRecord[] = [];
let cursorMs = Date.parse("2026-08-01T08:00:00.000Z");
const now = new Date("2026-09-12T08:00:00.000Z");

for (let index = 0; index < CATEGORY_ORDER.length; index += 1) {
  const category = CATEGORY_ORDER[index];
  assert.equal(isCategoryUnlocked(category, state), true, `${category} should be unlocked before its controlled mastery run.`);

  const blueprint = loadBlueprint(category);
  assert.equal(blueprint.category, category);
  const generated = masteryAttempts(category, blueprint, cursorMs);
  allAttempts = [...allAttempts, ...generated.attempts];
  cursorMs = generated.endMs + 60 * 60 * 1000;

  const sanitized = sanitizeLearnerState({ version: 1, attempts: allAttempts }, now);
  assert.ok(sanitized, `${category} controlled attempts should survive persistence reconciliation.`);
  state = sanitized;

  const skill = state.skills[category];
  assert.equal(skill.totalAttempts, 60);
  assert.equal(skill.correctAttempts, 60);
  assert.equal(skill.recentAccuracy, 1);
  assert.equal(skill.stableAcrossContexts, true);
  assert.equal(skill.delayedCheckPassed, true);
  assert.equal(skill.level, "mastery");

  const nextCategory = CATEGORY_ORDER[index + 1];
  if (nextCategory) {
    assert.equal(isCategoryUnlocked(nextCategory, state), true, `${nextCategory} should unlock only after ${category} mastery.`);
  }
}

assert.equal(state.skills.fluent_reading.level, "mastery");
assert.ok(allAttempts.every((attempt) => attempt.timing === undefined && attempt.voice === undefined));
console.log("Controlled S01-S03 path mastery reachability tests passed.");
