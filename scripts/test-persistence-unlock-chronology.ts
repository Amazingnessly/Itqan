import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { availableSessionIdsForActiveLesson } from "../src/learning/attemptRegistry.generated";
import { CATEGORY_RESOURCES } from "../src/learning/categoryCatalog";
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

const readingSessionIds = availableSessionIdsForActiveLesson(readingCategory);
assert.equal(readingSessionIds.length, 3, "Expected three active reading contexts.");
const readingSessions = readingSessionIds.map((sessionId) => canonicalSession(readingCategory, sessionId));
const readingAttempts: AttemptRecord[] = [];
let cursorMs = Date.parse("2026-08-22T08:00:00.000Z");
for (let cycle = 0; cycle < 2; cycle += 1) {
  if (cycle === 1) cursorMs += 13 * 60 * 60 * 1000;
  for (const session of readingSessions) {
    for (const interaction of session.interactions) {
      readingAttempts.push({
        category: readingCategory,
        sessionId: session.id,
        itemId: interaction.itemId,
        attemptedAt: new Date(cursorMs).toISOString(),
        outcome: "correct",
      });
      cursorMs += 60 * 1000;
    }
  }
}
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

console.log("Persisted category unlock chronology tests passed.");