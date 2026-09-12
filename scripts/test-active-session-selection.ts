import assert from "node:assert/strict";
import fs from "node:fs";
import { ControlledContentRepository } from "../src/learning/contentRepository";
import { LessonSessionEngine } from "../src/learning/sessionEngine";
import {
  isSessionAvailableForActiveLesson,
  sessionCompletionCountFromAuthorizedAttempts,
  sessionResumeIndexFromAuthorizedAttempts,
} from "../src/learning/attemptRegistry.generated";
import { nextSessionId } from "../src/learning/sessionCatalog";
import type { AttemptRecord, ControlledBatch, ExerciseBlueprint, ExerciseCategory } from "../src/learning/types";

function loadControlledSessionFixture(manifestPath: string, blueprintPath: string) {
  const batch = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as ControlledBatch;
  const blueprint = JSON.parse(fs.readFileSync(blueprintPath, "utf8")) as ExerciseBlueprint;
  const repository = new ControlledContentRepository([batch]);
  assert.doesNotThrow(() => repository.validateBlueprint(blueprint));
  return { blueprint, engine: new LessonSessionEngine(repository, blueprint) };
}

function cycleAttempts(
  category: ExerciseCategory,
  blueprint: ExerciseBlueprint,
  sessionId: string,
  cycle: number,
): AttemptRecord[] {
  const session = blueprint.sessions.find((candidate) => candidate.id === sessionId);
  assert.ok(session);
  return session.interactions.map((interaction, index) => ({
    category,
    sessionId,
    itemId: interaction.itemId,
    attemptedAt: new Date(Date.UTC(2026, 7, 24 + cycle, 8, index)).toISOString(),
    outcome: "correct" as const,
  }));
}

function assertThreeSessionPrefix(
  category: ExerciseCategory,
  blueprint: ExerciseBlueprint,
  engine: LessonSessionEngine,
  sessionIds: [string, string, string, string],
) {
  const [s1, s2, s3, s4] = sessionIds;
  assert.equal(isSessionAvailableForActiveLesson(category, s1), true);
  assert.equal(isSessionAvailableForActiveLesson(category, s2), true);
  assert.equal(isSessionAvailableForActiveLesson(category, s3), true);
  assert.equal(isSessionAvailableForActiveLesson(category, s4), false);

  const firstS1 = cycleAttempts(category, blueprint, s1, 0);
  const firstS2 = cycleAttempts(category, blueprint, s2, 0);
  const firstS3 = cycleAttempts(category, blueprint, s3, 0);
  assert.equal(nextSessionId(blueprint, []), s1);
  assert.equal(nextSessionId(blueprint, firstS1), s2);
  assert.equal(nextSessionId(blueprint, [...firstS1, ...firstS2]), s3);

  const firstRound = [...firstS1, ...firstS2, ...firstS3];
  assert.equal(nextSessionId(blueprint, firstRound), s1);
  assert.equal(sessionCompletionCountFromAuthorizedAttempts(category, s1, firstRound), 1);
  assert.equal(sessionCompletionCountFromAuthorizedAttempts(category, s2, firstRound), 1);
  assert.equal(sessionCompletionCountFromAuthorizedAttempts(category, s3, firstRound), 1);

  const secondS1 = cycleAttempts(category, blueprint, s1, 1);
  const partialLength = Math.max(1, Math.floor(secondS1.length / 2));
  const secondS1Partial = secondS1.slice(0, partialLength);
  assert.equal(nextSessionId(blueprint, [...firstRound, ...secondS1Partial]), s1);
  assert.equal(
    sessionResumeIndexFromAuthorizedAttempts(category, s1, [...firstRound, ...secondS1Partial]),
    partialLength,
  );
  assert.equal(sessionCompletionCountFromAuthorizedAttempts(category, s1, [...firstRound, ...secondS1Partial]), 1);

  const afterSecondS1 = [...firstRound, ...secondS1];
  assert.equal(sessionCompletionCountFromAuthorizedAttempts(category, s1, afterSecondS1), 2);
  assert.equal(sessionResumeIndexFromAuthorizedAttempts(category, s1, afterSecondS1), 0);
  assert.equal(nextSessionId(blueprint, afterSecondS1), s2);

  assert.doesNotThrow(() => engine.getSession(s1));
  assert.doesNotThrow(() => engine.getSession(s2));
  assert.doesNotThrow(() => engine.getSession(s3));
  assert.throws(() => engine.getSession(s4), /Inactive lesson session blocked/);
}

{
  const { blueprint, engine } = loadControlledSessionFixture(
    "public/content/verified/s110-batch01.json",
    "public/content/blueprints/units-batch01.json",
  );
  assertThreeSessionPrefix("reading_units", blueprint, engine, ["UNITS-B01-S01", "UNITS-B01-S02", "UNITS-B01-S03", "UNITS-B01-S04"]);
  assert.equal(isSessionAvailableForActiveLesson("reading_units", "UNITS-B01-S09"), false);
  assert.equal(isSessionAvailableForActiveLesson("reading_units", "UNITS-B01-S10"), false);
  assert.throws(() => engine.getSession("UNITS-B01-S09"), /Inactive lesson session blocked/);
  assert.throws(() => engine.getSession("UNITS-B01-S10"), /Inactive lesson session blocked/);
}

for (const [category, blueprintPath, sessionIds] of [
  ["vowels_sukun", "public/content/blueprints/vowels_sukun-batch02.json", ["VOWELS_SUKUN-B02-S01", "VOWELS_SUKUN-B02-S02", "VOWELS_SUKUN-B02-S03", "VOWELS_SUKUN-B02-S04"]],
  ["shaddah", "public/content/blueprints/shaddah-batch02.json", ["SHADDAH-B02-S01", "SHADDAH-B02-S02", "SHADDAH-B02-S03", "SHADDAH-B02-S04"]],
  ["article_al", "public/content/blueprints/article_al-batch02.json", ["ARTICLE_AL-B02-S01", "ARTICLE_AL-B02-S02", "ARTICLE_AL-B02-S03", "ARTICLE_AL-B02-S04"]],
  ["linking", "public/content/blueprints/linking-batch02.json", ["LINKING-B02-S01", "LINKING-B02-S02", "LINKING-B02-S03", "LINKING-B02-S04"]],
  ["fluent_reading", "public/content/blueprints/fluent_reading-batch02.json", ["FLUENT_READING-B02-S01", "FLUENT_READING-B02-S02", "FLUENT_READING-B02-S03", "FLUENT_READING-B02-S04"]],
] as const) {
  const { blueprint, engine } = loadControlledSessionFixture(
    "public/content/verified/s110-batch02.json",
    blueprintPath,
  );
  assertThreeSessionPrefix(category, blueprint, engine, sessionIds);
}

console.log("Active session selection tests passed.");
