import assert from "node:assert/strict";
import fs from "node:fs";
import { ControlledContentRepository } from "../src/learning/contentRepository";
import { LessonSessionEngine } from "../src/learning/sessionEngine";
import { isSessionAvailableForActiveLesson } from "../src/learning/attemptRegistry.generated";
import { nextSessionId } from "../src/learning/sessionCatalog";
import type { ControlledBatch, ExerciseBlueprint } from "../src/learning/types";

const batch = JSON.parse(fs.readFileSync("public/content/verified/s110-batch01.json", "utf8")) as ControlledBatch;
const blueprint = JSON.parse(fs.readFileSync("public/content/blueprints/units-batch01.json", "utf8")) as ExerciseBlueprint;
const repository = new ControlledContentRepository([batch]);

assert.doesNotThrow(() => repository.validateBlueprint(blueprint));
assert.equal(isSessionAvailableForActiveLesson("reading_units", "UNITS-B01-S01"), true);
assert.equal(isSessionAvailableForActiveLesson("reading_units", "UNITS-B01-S02"), true);
assert.equal(isSessionAvailableForActiveLesson("reading_units", "UNITS-B01-S03"), true);
assert.equal(isSessionAvailableForActiveLesson("reading_units", "UNITS-B01-S04"), false);
assert.equal(nextSessionId(blueprint, []), "UNITS-B01-S01");
assert.equal(nextSessionId(blueprint, ["UNITS-B01-S01"]), "UNITS-B01-S02");
assert.equal(nextSessionId(blueprint, ["UNITS-B01-S01", "UNITS-B01-S02"]), "UNITS-B01-S03");
assert.equal(nextSessionId(blueprint, ["UNITS-B01-S01", "UNITS-B01-S02", "UNITS-B01-S03"]), "UNITS-B01-S01");

const engine = new LessonSessionEngine(repository, blueprint);
assert.doesNotThrow(() => engine.getSession("UNITS-B01-S01"));
assert.doesNotThrow(() => engine.getSession("UNITS-B01-S02"));
assert.doesNotThrow(() => engine.getSession("UNITS-B01-S03"));
assert.throws(() => engine.getSession("UNITS-B01-S04"));

console.log("Active session selection tests passed.");
