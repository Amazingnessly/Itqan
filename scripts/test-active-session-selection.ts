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

{
  const { blueprint, engine } = loadControlledSessionFixture(
    "public/content/verified/s110-batch01.json",
    "public/content/blueprints/units-batch01.json",
  );

  assert.equal(isSessionAvailableForActiveLesson("reading_units", "UNITS-B01-S01"), true);
  assert.equal(isSessionAvailableForActiveLesson("reading_units", "UNITS-B01-S02"), true);
  assert.equal(isSessionAvailableForActiveLesson("reading_units", "UNITS-B01-S03"), true);
  assert.equal(isSessionAvailableForActiveLesson("reading_units", "UNITS-B01-S04"), false);
  assert.equal(isSessionAvailableForActiveLesson("reading_units", "UNITS-B01-S09"), false);
  assert.equal(isSessionAvailableForActiveLesson("reading_units", "UNITS-B01-S10"), false);
  assert.equal(nextSessionId(blueprint, []), "UNITS-B01-S01");
  assert.equal(nextSessionId(blueprint, ["UNITS-B01-S01"]), "UNITS-B01-S02");
  assert.equal(nextSessionId(blueprint, ["UNITS-B01-S01", "UNITS-B01-S02"]), "UNITS-B01-S03");
  assert.equal(nextSessionId(blueprint, ["UNITS-B01-S01", "UNITS-B01-S02", "UNITS-B01-S03"]), "UNITS-B01-S01");

  assert.doesNotThrow(() => engine.getSession("UNITS-B01-S01"));
  assert.doesNotThrow(() => engine.getSession("UNITS-B01-S02"));
  assert.doesNotThrow(() => engine.getSession("UNITS-B01-S03"));
  assert.throws(() => engine.getSession("UNITS-B01-S04"), /Inactive lesson session blocked/);
  assert.throws(() => engine.getSession("UNITS-B01-S09"), /Inactive lesson session blocked/);
  assert.throws(() => engine.getSession("UNITS-B01-S10"), /Inactive lesson session blocked/);
}

{
  const { blueprint, engine } = loadControlledSessionFixture(
    "public/content/verified/s110-batch02.json",
    "public/content/blueprints/vowels_sukun-batch02.json",
  );

  assert.equal(isSessionAvailableForActiveLesson("vowels_sukun", "VOWELS_SUKUN-B02-S01"), true);
  assert.equal(isSessionAvailableForActiveLesson("vowels_sukun", "VOWELS_SUKUN-B02-S02"), true);
  assert.equal(isSessionAvailableForActiveLesson("vowels_sukun", "VOWELS_SUKUN-B02-S03"), true);
  assert.equal(isSessionAvailableForActiveLesson("vowels_sukun", "VOWELS_SUKUN-B02-S04"), false);
  assert.equal(nextSessionId(blueprint, []), "VOWELS_SUKUN-B02-S01");
  assert.equal(nextSessionId(blueprint, ["VOWELS_SUKUN-B02-S01"]), "VOWELS_SUKUN-B02-S02");
  assert.equal(nextSessionId(blueprint, ["VOWELS_SUKUN-B02-S01", "VOWELS_SUKUN-B02-S02"]), "VOWELS_SUKUN-B02-S03");
  assert.equal(nextSessionId(blueprint, ["VOWELS_SUKUN-B02-S01", "VOWELS_SUKUN-B02-S02", "VOWELS_SUKUN-B02-S03"]), "VOWELS_SUKUN-B02-S01");

  assert.doesNotThrow(() => engine.getSession("VOWELS_SUKUN-B02-S01"));
  assert.doesNotThrow(() => engine.getSession("VOWELS_SUKUN-B02-S02"));
  assert.doesNotThrow(() => engine.getSession("VOWELS_SUKUN-B02-S03"));
  assert.throws(() => engine.getSession("VOWELS_SUKUN-B02-S04"), /Inactive lesson session blocked/);
}

{
  const { blueprint, engine } = loadControlledSessionFixture(
    "public/content/verified/s110-batch02.json",
    "public/content/blueprints/shaddah-batch02.json",
  );

  assert.equal(isSessionAvailableForActiveLesson("shaddah", "SHADDAH-B02-S01"), true);
  assert.equal(isSessionAvailableForActiveLesson("shaddah", "SHADDAH-B02-S02"), true);
  assert.equal(isSessionAvailableForActiveLesson("shaddah", "SHADDAH-B02-S03"), true);
  assert.equal(isSessionAvailableForActiveLesson("shaddah", "SHADDAH-B02-S04"), false);
  assert.equal(nextSessionId(blueprint, []), "SHADDAH-B02-S01");
  assert.equal(nextSessionId(blueprint, ["SHADDAH-B02-S01"]), "SHADDAH-B02-S02");
  assert.equal(nextSessionId(blueprint, ["SHADDAH-B02-S01", "SHADDAH-B02-S02"]), "SHADDAH-B02-S03");
  assert.equal(nextSessionId(blueprint, ["SHADDAH-B02-S01", "SHADDAH-B02-S02", "SHADDAH-B02-S03"]), "SHADDAH-B02-S01");

  assert.doesNotThrow(() => engine.getSession("SHADDAH-B02-S01"));
  assert.doesNotThrow(() => engine.getSession("SHADDAH-B02-S02"));
  assert.doesNotThrow(() => engine.getSession("SHADDAH-B02-S03"));
  assert.throws(() => engine.getSession("SHADDAH-B02-S04"), /Inactive lesson session blocked/);
}

console.log("Active session selection tests passed.");
