import assert from "node:assert/strict";
import fs from "node:fs";
import { ControlledContentRepository } from "../src/learning/contentRepository";
import { LessonSessionEngine } from "../src/learning/sessionEngine";
import { isSessionAvailableForActiveLesson } from "../src/learning/attemptRegistry.generated";
import { nextSessionId } from "../src/learning/sessionCatalog";
import type { ControlledBatch, ExerciseBlueprint } from "../src/learning/types";

function loadControlledSessionFixture(manifestPath: string, blueprintPath: string) {
  const batch = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as ControlledBatch;
  const blueprint = JSON.parse(fs.readFileSync(blueprintPath, "utf8")) as ExerciseBlueprint;
  const repository = new ControlledContentRepository([batch]);
  assert.doesNotThrow(() => repository.validateBlueprint(blueprint));
  return { blueprint, engine: new LessonSessionEngine(repository, blueprint) };
}

function assertThreeSessionPrefix(
  category: Parameters<typeof isSessionAvailableForActiveLesson>[0],
  blueprint: ExerciseBlueprint,
  engine: LessonSessionEngine,
  sessionIds: [string, string, string, string],
) {
  const [s1, s2, s3, s4] = sessionIds;
  assert.equal(isSessionAvailableForActiveLesson(category, s1), true);
  assert.equal(isSessionAvailableForActiveLesson(category, s2), true);
  assert.equal(isSessionAvailableForActiveLesson(category, s3), true);
  assert.equal(isSessionAvailableForActiveLesson(category, s4), false);
  assert.equal(nextSessionId(blueprint, []), s1);
  assert.equal(nextSessionId(blueprint, [s1]), s2);
  assert.equal(nextSessionId(blueprint, [s1, s2]), s3);
  assert.equal(nextSessionId(blueprint, [s1, s2, s3]), s1);
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
] as const) {
  const { blueprint, engine } = loadControlledSessionFixture(
    "public/content/verified/s110-batch02.json",
    blueprintPath,
  );
  assertThreeSessionPrefix(category, blueprint, engine, sessionIds);
}

console.log("Active session selection tests passed.");
