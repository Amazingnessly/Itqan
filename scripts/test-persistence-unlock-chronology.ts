import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { availableSessionIdsForActiveLesson } from "../src/learning/attemptRegistry.generated";
import { CATEGORY_RESOURCES } from "../src/learning/categoryCatalog";
import { createInitialLearnerState, isCategoryUnlocked } from "../src/learning/mastery";
import { sanitizeLearnerState } from "../src/learning/persistence";
import type { AttemptRecord, ExerciseBlueprint, ExerciseCategory } from "../src/learning/types";

function loadControlledJson<T>(url: string): T {
  const filePath = path.join(process.cwd(), url.replace(/^\//, "public/"));
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function blueprintFor(category: ExerciseCategory): ExerciseBlueprint {
  return loadControlledJson<ExerciseBlueprint>(CATEGORY_RESOURCES[category].blueprintUrl);
}

function canonicalSession(category: ExerciseCategory, sessionId: string) {
  const session = blueprintFor(category).sessions.find((candidate) => candidate.id === sessionId);
  assert.ok(session, `Expected controlled session ${sessionId}.`);
  return session;
}

function twoMasteryCycles(category: ExerciseCategory, startMs: number): { attempts: AttemptRecord[]; nextMs: number } {
  const sessionIds = availableSessionIdsForActiveLesson(category);
  assert.equal(sessionIds.length, 3, `Expected three active contexts for ${category}.`);
  const sessions = sessionIds.map((sessionId) => canonicalSession(category, sessionId));
  const attempts: AttemptRecord[] = [];
  let cursorMs = startMs;
  for (let cycle = 0; cycle < 2; cycle += 1) {
    if (cycle === 1) cursorMs += 13 * 60 * 60 * 1000;
    for (const session of sessions) {
      for (const interaction of session.interactions) {
        attempts.push({
          category,
          sessionId: session.id,
          itemId: interaction.itemId,
          attemptedAt: new Date(cursorMs).toISOString(),
          outcome: "correct",
        });
        cursorMs += 60 * 1000;
      }
    }
  }
  return { attempts, nextMs: cursorMs };
}

const readingCategory: ExerciseCategory = "reading_units";
const vowelsCategory: ExerciseCategory = "vowels_sukun";
const vowelsSessionId = availableSessionIdsForActiveLesson(vowelsCategory)[0];
assert.ok(vowelsSessionId, "Expected an active controlled vowels/sukun session.");
const vowelsSession = canonicalSession(vowelsCategory, vowelsSessionId);
const vowelsInteraction = vowelsSession.interactions[0];
assert.ok(vowelsInteraction, "Expected a controlled vowels/sukun interaction.");

const lockedAttempt: AttemptRecord = {
  category: vowelsCategory,
  sessionId: vowelsSessionId,
  itemId: vowelsInteraction.itemId,
  attemptedAt: "2026-08-22T08:00:00.000Z",
  outcome: "correct",
};
const lockedSanitized = sanitizeLearnerState(
  { version: 1, attempts: [lockedAttempt] },
  new Date("2026-08-24T12:00:00.000Z"),
);
assert.ok(lockedSanitized);
assert.equal(lockedSanitized.attempts.length, 0);
assert.equal(lockedSanitized.skills.vowels_sukun.totalAttempts, 0);

const readingMastery = twoMasteryCycles(readingCategory, Date.parse("2026-08-22T08:00:00.000Z"));
const readingAttempts = readingMastery.attempts;
let cursorMs = readingMastery.nextMs;
assert.equal(readingAttempts.length, 60);

const unlockedAttempt: AttemptRecord = {
  ...lockedAttempt,
  attemptedAt: new Date(cursorMs).toISOString(),
};
const unlockedSanitized = sanitizeLearnerState(
  { version: 1, attempts: [...readingAttempts, unlockedAttempt] },
  new Date("2026-08-24T12:00:00.000Z"),
);
assert.ok(unlockedSanitized);
assert.equal(unlockedSanitized.skills.reading_units.level, "mastery");
assert.equal(unlockedSanitized.skills.vowels_sukun.totalAttempts, 1);
assert.equal(unlockedSanitized.attempts.at(-1)?.category, vowelsCategory);
assert.equal(unlockedSanitized.attempts.at(-1)?.itemId, vowelsInteraction.itemId);

const runtimeState = createInitialLearnerState();
runtimeState.skills.reading_units = { ...runtimeState.skills.reading_units, level: "consolidation" };
runtimeState.skills.vowels_sukun = { ...runtimeState.skills.vowels_sukun, level: "mastery" };
assert.equal(isCategoryUnlocked("shaddah", runtimeState), false);
runtimeState.skills.reading_units = { ...runtimeState.skills.reading_units, level: "mastery" };
assert.equal(isCategoryUnlocked("shaddah", runtimeState), true);

const vowelsMastery = twoMasteryCycles(vowelsCategory, cursorMs);
cursorMs = vowelsMastery.nextMs;
const readingFirstSession = canonicalSession(readingCategory, availableSessionIdsForActiveLesson(readingCategory)[0]);
const readingRegression: AttemptRecord = {
  category: readingCategory,
  sessionId: readingFirstSession.id,
  itemId: readingFirstSession.interactions[0].itemId,
  attemptedAt: new Date(cursorMs).toISOString(),
  outcome: "incorrect",
};
cursorMs += 60 * 1000;
const shaddahCategory: ExerciseCategory = "shaddah";
const shaddahSession = canonicalSession(shaddahCategory, availableSessionIdsForActiveLesson(shaddahCategory)[0]);
const shaddahAttempt: AttemptRecord = {
  category: shaddahCategory,
  sessionId: shaddahSession.id,
  itemId: shaddahSession.interactions[0].itemId,
  attemptedAt: new Date(cursorMs).toISOString(),
  outcome: "correct",
};
const transitiveSanitized = sanitizeLearnerState(
  {
    version: 1,
    attempts: [
      ...readingAttempts,
      ...vowelsMastery.attempts,
      readingRegression,
      shaddahAttempt,
    ],
  },
  new Date("2026-08-24T12:00:00.000Z"),
);
assert.ok(transitiveSanitized);
assert.equal(transitiveSanitized.skills.reading_units.level, "consolidation");
assert.equal(transitiveSanitized.skills.vowels_sukun.level, "mastery");
assert.equal(transitiveSanitized.skills.shaddah.totalAttempts, 0);
assert.equal(transitiveSanitized.attempts.some((attempt) => attempt.category === shaddahCategory), false);

console.log("Persisted category unlock chronology and transitive prerequisite tests passed.");