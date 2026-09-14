import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { availableSessionIdsForActiveLesson } from "../src/learning/attemptRegistry.generated";
import { CATEGORY_RESOURCES } from "../src/learning/categoryCatalog";
import { mostRecentIncompleteLessonTarget } from "../src/learning/sessionCatalog";
import type { AttemptRecord, ExerciseBlueprint, ExerciseCategory } from "../src/learning/types";

function blueprint(category: ExerciseCategory): ExerciseBlueprint {
  const filePath = path.join(process.cwd(), CATEGORY_RESOURCES[category].blueprintUrl.replace(/^\//, "public/"));
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as ExerciseBlueprint;
}

function activeSession(category: ExerciseCategory) {
  const sessionId = availableSessionIdsForActiveLesson(category)[0];
  assert.ok(sessionId, `Expected an active session for ${category}.`);
  const session = blueprint(category).sessions.find((candidate) => candidate.id === sessionId);
  assert.ok(session, `Expected controlled session ${sessionId}.`);
  assert.ok(session.interactions.length > 1, `Expected ${sessionId} to support an incomplete-cycle test.`);
  return session;
}

function attempt(
  category: ExerciseCategory,
  sessionId: string,
  itemId: string,
  attemptedAt: string,
): AttemptRecord {
  return { category, sessionId, itemId, attemptedAt, outcome: "correct" };
}

const reading = activeSession("reading_units");
const vowels = activeSession("vowels_sukun");
const sameTimestamp = "2026-09-14T09:00:00.000Z";
const readingPartial = attempt(
  "reading_units",
  reading.id,
  reading.interactions[0].itemId,
  sameTimestamp,
);
const vowelsPartial = attempt(
  "vowels_sukun",
  vowels.id,
  vowels.interactions[0].itemId,
  sameTimestamp,
);

assert.deepEqual(
  mostRecentIncompleteLessonTarget(
    ["reading_units", "vowels_sukun"],
    [readingPartial, vowelsPartial],
  ),
  { category: "vowels_sukun", sessionId: vowels.id },
);
assert.deepEqual(
  mostRecentIncompleteLessonTarget(
    ["vowels_sukun", "reading_units"],
    [readingPartial, vowelsPartial],
  ),
  { category: "vowels_sukun", sessionId: vowels.id },
);

const completedReading = reading.interactions.map((interaction, index) =>
  attempt(
    "reading_units",
    reading.id,
    interaction.itemId,
    new Date(Date.UTC(2026, 8, 14, 8, index)).toISOString(),
  )
);
const laterVowelsPartial = attempt(
  "vowels_sukun",
  vowels.id,
  vowels.interactions[0].itemId,
  "2026-09-14T10:00:00.000Z",
);

assert.deepEqual(
  mostRecentIncompleteLessonTarget(
    ["reading_units", "vowels_sukun"],
    [...completedReading, laterVowelsPartial],
  ),
  { category: "vowels_sukun", sessionId: vowels.id },
);
assert.equal(
  mostRecentIncompleteLessonTarget(["reading_units"], completedReading),
  undefined,
);

console.log("Cross-category incomplete lesson selection tests passed.");
