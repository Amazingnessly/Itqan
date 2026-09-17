import assert from "node:assert/strict";
import fs from "node:fs";
import {
  isSessionAvailableForActiveLesson,
  sessionResumeIndexFromAuthorizedAttempts,
} from "../src/learning/attemptRegistry.generated";
import {
  CATEGORY_RESOURCES,
  LEARNING_STAGES,
  type LearningStageDefinition,
} from "../src/learning/categoryCatalog";
import {
  createInitialLearnerState,
  isCategoryUnlocked,
  isLearningStageUnlocked,
  isPathMastered,
  learningStageSkill,
} from "../src/learning/mastery";
import { sanitizeLearnerState } from "../src/learning/persistence";
import {
  availableSessionIdsForLearningStage,
  nextSessionId,
} from "../src/learning/sessionCatalog";
import type { AttemptRecord, ExerciseBlueprint, ExerciseCategory, LearnerState } from "../src/learning/types";

function loadBlueprint(category: ExerciseCategory): ExerciseBlueprint {
  const filePath = CATEGORY_RESOURCES[category].blueprintUrl.replace(/^\//, "public/");
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as ExerciseBlueprint;
}

function masteryAttempts(
  stage: LearningStageDefinition,
  blueprint: ExerciseBlueprint,
  priorAttempts: AttemptRecord[],
  startMs: number,
): { attempts: AttemptRecord[]; endMs: number } {
  const sessionIds = availableSessionIdsForLearningStage(stage.id);
  assert.equal(sessionIds.length, 3, `${stage.id} must expose exactly three controlled mastery contexts.`);
  const sessions = sessionIds.map((sessionId) => {
    assert.equal(isSessionAvailableForActiveLesson(stage.category, sessionId), true);
    const session = blueprint.sessions.find((candidate) => candidate.id === sessionId);
    assert.ok(session, `${stage.id}/${sessionId} must exist in its controlled blueprint.`);
    return session;
  });

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

    const selectedId = nextSessionId(
      blueprint,
      [...priorAttempts, ...attempts],
      stage.id,
    );
    assert.ok(selectedId, `${stage.id} should always have a controlled session.`);
    const session = sessions.find((candidate) => candidate.id === selectedId);
    assert.ok(session, `${stage.id}/${selectedId} must stay inside its assigned three-session phase.`);
    selectedSessions.push(selectedId);

    for (const interaction of session.interactions) {
      if (attempts.length >= 60) break;
      attempts.push({
        category: stage.category,
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
    sessionIds[0],
    sessionIds[1],
    sessionIds[2],
    sessionIds[0],
    sessionIds[1],
    sessionIds[2],
  ]);
  assert.equal(new Set(attempts.slice(-30).map((attempt) => attempt.sessionId)).size, 3);
  assert.ok(attempts.every((attempt) => attempt.timing === undefined && attempt.voice === undefined));
  return { attempts, endMs: cursorMs };
}

function canonicalAttempt(
  stage: LearningStageDefinition,
  blueprint: ExerciseBlueprint,
  attempts: AttemptRecord[],
  attemptedAt: string,
  outcome: "correct" | "incorrect",
): AttemptRecord {
  const sessionId = nextSessionId(blueprint, attempts, stage.id);
  assert.ok(sessionId, `${stage.id} should expose a controlled session for recovery.`);
  const session = blueprint.sessions.find((candidate) => candidate.id === sessionId);
  assert.ok(session, `${stage.id}/${sessionId} must exist in its controlled blueprint.`);
  const resumeIndex = sessionResumeIndexFromAuthorizedAttempts(stage.category, sessionId, attempts);
  const interaction = session.interactions[resumeIndex];
  assert.ok(interaction, `${stage.id}/${sessionId} must expose the canonical recovery interaction.`);
  return {
    category: stage.category,
    sessionId,
    itemId: interaction.itemId,
    attemptedAt,
    outcome,
  };
}

let state: LearnerState = createInitialLearnerState();
let allAttempts: AttemptRecord[] = [];
let cursorMs = Date.parse("2026-08-01T08:00:00.000Z");
const now = new Date("2026-09-12T08:00:00.000Z");

for (let index = 0; index < LEARNING_STAGES.length; index += 1) {
  const stage = LEARNING_STAGES[index];
  assert.equal(
    isLearningStageUnlocked(stage.id, state),
    true,
    `${stage.id} should be unlocked before its controlled mastery run.`,
  );

  const blueprint = loadBlueprint(stage.category);
  assert.equal(blueprint.category, stage.category);
  const generated = masteryAttempts(stage, blueprint, allAttempts, cursorMs);
  allAttempts = [...allAttempts, ...generated.attempts];
  cursorMs = generated.endMs + 60 * 60 * 1000;

  const sanitized = sanitizeLearnerState({ version: 1, attempts: allAttempts }, now);
  assert.ok(sanitized, `${stage.id} controlled attempts should survive persistence reconciliation.`);
  state = sanitized;

  const skill = learningStageSkill(state, stage.id);
  assert.equal(skill.totalAttempts, 60, `${stage.id} must have 60 stage-scoped attempts.`);
  assert.equal(skill.correctAttempts, 60);
  assert.equal(skill.recentAccuracy, 1);
  assert.equal(skill.stableAcrossContexts, true);
  assert.equal(skill.delayedCheckPassed, true);
  assert.equal(skill.level, "mastery");

  const nextStage = LEARNING_STAGES[index + 1];
  if (nextStage) {
    assert.equal(
      isLearningStageUnlocked(nextStage.id, state),
      true,
      `${nextStage.id} should unlock only after ${stage.id} mastery.`,
    );
  }
}

assert.equal(learningStageSkill(state, "fluent_reading").level, "mastery");
assert.equal(isPathMastered(state), true);
assert.ok(allAttempts.every((attempt) => attempt.timing === undefined && attempt.voice === undefined));

const readingStage = LEARNING_STAGES[0];
const readingBlueprint = loadBlueprint("reading_units");
const regression = canonicalAttempt(
  readingStage,
  readingBlueprint,
  allAttempts,
  new Date(cursorMs).toISOString(),
  "incorrect",
);
allAttempts = [...allAttempts, regression];
cursorMs += 60_000;

let recovered = sanitizeLearnerState({ version: 1, attempts: allAttempts }, now);
assert.ok(recovered, "The controlled regression should survive persistence reconciliation.");
assert.equal(recovered.skills.reading_units.delayedCheckPassed, false);
assert.notEqual(recovered.skills.reading_units.level, "mastery");
assert.equal(isCategoryUnlocked("vowels_sukun", recovered), false);
assert.equal(isLearningStageUnlocked("article_qamariyyah", recovered), false);
assert.equal(isLearningStageUnlocked("article_shamsiyyah", recovered), false);
assert.equal(isCategoryUnlocked("fluent_reading", recovered), false);
assert.equal(isPathMastered(recovered), false);
assert.equal(
  learningStageSkill(recovered, "article_shamsiyyah").level,
  "mastery",
  "Historical downstream mastery evidence should remain stored while relocked.",
);

for (let index = 0; index < 20; index += 1) {
  const recovery = canonicalAttempt(
    readingStage,
    readingBlueprint,
    allAttempts,
    new Date(cursorMs).toISOString(),
    "correct",
  );
  allAttempts = [...allAttempts, recovery];
  cursorMs += 60_000;
}

recovered = sanitizeLearnerState({ version: 1, attempts: allAttempts }, now);
assert.ok(recovered, "Immediate controlled recovery should survive persistence reconciliation.");
assert.equal(recovered.skills.reading_units.recentAccuracy, 1);
assert.equal(recovered.skills.reading_units.stableAcrossContexts, true);
assert.equal(recovered.skills.reading_units.delayedCheckPassed, false);
assert.equal(recovered.skills.reading_units.level, "consolidation");
assert.equal(isCategoryUnlocked("vowels_sukun", recovered), false);
assert.ok(recovered.skills.reading_units.nextReviewAt);

const reconfirmAt = recovered.skills.reading_units.nextReviewAt!;
allAttempts = [...allAttempts, canonicalAttempt(
  readingStage,
  readingBlueprint,
  allAttempts,
  reconfirmAt,
  "correct",
)];

recovered = sanitizeLearnerState({ version: 1, attempts: allAttempts }, now);
assert.ok(recovered, "Delayed controlled reconfirmation should survive persistence reconciliation.");
assert.equal(recovered.skills.reading_units.delayedCheckPassed, true);
assert.equal(recovered.skills.reading_units.level, "mastery");
assert.equal(isCategoryUnlocked("vowels_sukun", recovered), true);
assert.equal(isLearningStageUnlocked("article_qamariyyah", recovered), true);
assert.equal(isLearningStageUnlocked("article_shamsiyyah", recovered), true);
assert.equal(isCategoryUnlocked("fluent_reading", recovered), true);
assert.equal(learningStageSkill(recovered, "fluent_reading").level, "mastery");
assert.equal(isPathMastered(recovered), true);

console.log("Controlled seven-stage path mastery and regression recovery tests passed.");
