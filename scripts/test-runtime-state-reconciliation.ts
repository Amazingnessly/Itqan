import assert from "node:assert/strict";
import fs from "node:fs";
import { ControlledContentRepository } from "../src/learning/contentRepository";
import { createInitialLearnerState } from "../src/learning/mastery";
import { LessonSessionEngine } from "../src/learning/sessionEngine";
import type { AttemptRecord, ControlledBatch, ExerciseBlueprint } from "../src/learning/types";

function loadJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

const batch01 = loadJson<ControlledBatch>("public/content/verified/s110-batch01.json");
const readingBlueprint = loadJson<ExerciseBlueprint>("public/content/blueprints/units-batch01.json");
const readingSession = readingBlueprint.sessions.find((session) => session.id === "UNITS-B01-S01")!;
const readingInteraction = readingSession.interactions[0];
const readingEngine = new LessonSessionEngine(new ControlledContentRepository([batch01]), readingBlueprint);

const batch02 = loadJson<ControlledBatch>("public/content/verified/s110-batch02.json");
const vowelsBlueprint = loadJson<ExerciseBlueprint>("public/content/blueprints/vowels_sukun-batch02.json");
const lockedSession = vowelsBlueprint.sessions[0];
const lockedInteraction = lockedSession.interactions[0];
const lockedEngine = new LessonSessionEngine(new ControlledContentRepository([batch02]), vowelsBlueprint);

const baseAttempt = { attemptedAt: new Date().toISOString(), outcome: "correct" as const };
const forgedUnlock = createInitialLearnerState();
forgedUnlock.skills.reading_units = { ...forgedUnlock.skills.reading_units, level: "excellence" };
assert.throws(
  () => lockedEngine.record(forgedUnlock, {
    ...baseAttempt,
    itemId: lockedInteraction.itemId,
    sessionId: lockedSession.id,
  }),
  /locked lesson category/,
);

const forgedAttempt: AttemptRecord = {
  itemId: "forged-item",
  category: "reading_units",
  sessionId: "forged-session",
  attemptedAt: new Date(Date.now() - 60_000).toISOString(),
  outcome: "correct",
};
const forgedHistory = createInitialLearnerState();
forgedHistory.attempts = [forgedAttempt];
forgedHistory.xp = 9999;
forgedHistory.skills.reading_units = { ...forgedHistory.skills.reading_units, level: "excellence", totalAttempts: 999 };
const reconciled = readingEngine.record(forgedHistory, {
  ...baseAttempt,
  itemId: readingInteraction.itemId,
  sessionId: readingSession.id,
});
assert.equal(reconciled.attempts.length, 1);
assert.equal(reconciled.attempts[0].sessionId, readingSession.id);
assert.equal(reconciled.xp, 5);

console.log("Runtime learner-state reconciliation tests passed.");
