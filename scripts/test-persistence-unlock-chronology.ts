import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { availableSessionIdsForActiveLesson } from "../src/learning/attemptRegistry.generated";
import {
  ARTICLE_QAMARIYYAH_SESSION_IDS,
  ARTICLE_SHAMSIYYAH_SESSION_IDS,
  CATEGORY_RESOURCES,
} from "../src/learning/categoryCatalog";
import {
  isCategoryUnlocked,
  isLearningStageUnlocked,
} from "../src/learning/mastery";
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

function threeActiveSessionIds(category: ExerciseCategory): [string, string, string] {
  const ids = availableSessionIdsForActiveLesson(category);
  assert.ok(ids.length >= 3, `Expected at least three active contexts for ${category}.`);
  return [ids[0], ids[1], ids[2]];
}

function twoMasteryCycles(
  category: ExerciseCategory,
  sessionIds: readonly [string, string, string],
  startMs: number,
): { attempts: AttemptRecord[]; nextMs: number } {
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
  assert.equal(attempts.length, 60);
  return { attempts, nextMs: cursorMs };
}

function firstAttempt(
  category: ExerciseCategory,
  sessionId: string,
  attemptedAt: number,
  outcome: AttemptRecord["outcome"] = "correct",
): AttemptRecord {
  const session = canonicalSession(category, sessionId);
  return {
    category,
    sessionId,
    itemId: session.interactions[0].itemId,
    attemptedAt: new Date(attemptedAt).toISOString(),
    outcome,
  };
}

const now = new Date("2026-09-12T12:00:00.000Z");
let cursorMs = Date.parse("2026-08-01T08:00:00.000Z");

const readingIds = threeActiveSessionIds("reading_units");
const vowelsIds = threeActiveSessionIds("vowels_sukun");
const shaddahIds = threeActiveSessionIds("shaddah");
const linkingIds = threeActiveSessionIds("linking");
const qamIds = [...ARTICLE_QAMARIYYAH_SESSION_IDS] as [string, string, string];
const shamsIds = [...ARTICLE_SHAMSIYYAH_SESSION_IDS] as [string, string, string];

const lockedVowels = firstAttempt("vowels_sukun", vowelsIds[0], cursorMs);
let sanitized = sanitizeLearnerState({ version: 1, attempts: [lockedVowels] }, now);
assert.ok(sanitized);
assert.equal(sanitized.attempts.length, 0);

const reading = twoMasteryCycles("reading_units", readingIds, cursorMs);
cursorMs = reading.nextMs + 60 * 60 * 1000;
const unlockedVowels = firstAttempt("vowels_sukun", vowelsIds[0], cursorMs);
sanitized = sanitizeLearnerState({ version: 1, attempts: [...reading.attempts, unlockedVowels] }, now);
assert.ok(sanitized);
assert.equal(sanitized.skills.reading_units.level, "mastery");
assert.equal(sanitized.skills.vowels_sukun.totalAttempts, 1);

const vowels = twoMasteryCycles("vowels_sukun", vowelsIds, cursorMs + 60_000);
cursorMs = vowels.nextMs + 60 * 60 * 1000;
const historyThroughVowels = [...reading.attempts, ...vowels.attempts];

const prematureShaddah = firstAttempt("shaddah", shaddahIds[0], cursorMs);
sanitized = sanitizeLearnerState(
  { version: 1, attempts: [...historyThroughVowels, prematureShaddah] },
  now,
);
assert.ok(sanitized);
assert.equal(sanitized.skills.shaddah.totalAttempts, 0);
assert.equal(isCategoryUnlocked("article_al", sanitized), true);
assert.equal(isCategoryUnlocked("shaddah", sanitized), false);
assert.equal(isLearningStageUnlocked("article_qamariyyah", sanitized), true);
assert.equal(isLearningStageUnlocked("article_shamsiyyah", sanitized), false);

const firstQam = firstAttempt("article_al", qamIds[0], cursorMs + 60_000);
sanitized = sanitizeLearnerState(
  { version: 1, attempts: [...historyThroughVowels, firstQam] },
  now,
);
assert.ok(sanitized);
assert.equal(sanitized.skills.article_al.totalAttempts, 1);
assert.equal(sanitized.attempts.at(-1)?.sessionId, qamIds[0]);

const qam = twoMasteryCycles("article_al", qamIds, cursorMs + 120_000);
cursorMs = qam.nextMs + 60 * 60 * 1000;
const historyThroughQam = [...historyThroughVowels, ...qam.attempts];
sanitized = sanitizeLearnerState({ version: 1, attempts: historyThroughQam }, now);
assert.ok(sanitized);
assert.equal(isCategoryUnlocked("shaddah", sanitized), true);
assert.equal(isLearningStageUnlocked("article_shamsiyyah", sanitized), false);

const prematureShams = firstAttempt("article_al", shamsIds[0], cursorMs);
sanitized = sanitizeLearnerState(
  { version: 1, attempts: [...historyThroughQam, prematureShams] },
  now,
);
assert.ok(sanitized);
assert.equal(
  sanitized.attempts.some((attempt) => attempt.sessionId === shamsIds[0]),
  false,
);

const shaddah = twoMasteryCycles("shaddah", shaddahIds, cursorMs + 60_000);
cursorMs = shaddah.nextMs + 60 * 60 * 1000;
const historyThroughShaddah = [...historyThroughQam, ...shaddah.attempts];
sanitized = sanitizeLearnerState({ version: 1, attempts: historyThroughShaddah }, now);
assert.ok(sanitized);
assert.equal(isLearningStageUnlocked("article_shamsiyyah", sanitized), true);
assert.equal(isCategoryUnlocked("linking", sanitized), false);

const firstShams = firstAttempt("article_al", shamsIds[0], cursorMs);
sanitized = sanitizeLearnerState(
  { version: 1, attempts: [...historyThroughShaddah, firstShams] },
  now,
);
assert.ok(sanitized);
assert.equal(sanitized.attempts.at(-1)?.sessionId, shamsIds[0]);

const prematureLinking = firstAttempt("linking", linkingIds[0], cursorMs + 60_000);
sanitized = sanitizeLearnerState(
  { version: 1, attempts: [...historyThroughShaddah, prematureLinking] },
  now,
);
assert.ok(sanitized);
assert.equal(sanitized.skills.linking.totalAttempts, 0);

const shams = twoMasteryCycles("article_al", shamsIds, cursorMs + 120_000);
cursorMs = shams.nextMs + 60 * 60 * 1000;
const historyThroughShams = [...historyThroughShaddah, ...shams.attempts];
sanitized = sanitizeLearnerState({ version: 1, attempts: historyThroughShams }, now);
assert.ok(sanitized);
assert.equal(isCategoryUnlocked("linking", sanitized), true);

const unlockedLinking = firstAttempt("linking", linkingIds[0], cursorMs);
sanitized = sanitizeLearnerState(
  { version: 1, attempts: [...historyThroughShams, unlockedLinking] },
  now,
);
assert.ok(sanitized);
assert.equal(sanitized.skills.linking.totalAttempts, 1);

const readingRegression = firstAttempt("reading_units", readingIds[0], cursorMs + 60_000, "incorrect");
const postRegressionShams = firstAttempt("article_al", shamsIds[0], cursorMs + 120_000);
const regressed = sanitizeLearnerState(
  {
    version: 1,
    attempts: [...historyThroughShams, readingRegression, postRegressionShams],
  },
  now,
);
assert.ok(regressed);
assert.notEqual(regressed.skills.reading_units.level, "mastery");
assert.equal(isCategoryUnlocked("vowels_sukun", regressed), false);
assert.equal(isLearningStageUnlocked("article_shamsiyyah", regressed), false);
assert.equal(
  regressed.attempts.at(-1)?.sessionId === shamsIds[0]
    && regressed.attempts.at(-1)?.attemptedAt === postRegressionShams.attemptedAt,
  false,
);

console.log("Persisted seven-stage unlock chronology and transitive prerequisite tests passed.");
