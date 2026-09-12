import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { availableSessionIdsForActiveLesson } from "../src/learning/attemptRegistry.generated";
import { CATEGORY_RESOURCES } from "../src/learning/categoryCatalog";
import { ControlledContentRepository } from "../src/learning/contentRepository";
import { createInitialLearnerState } from "../src/learning/mastery";
import { LessonSessionEngine } from "../src/learning/sessionEngine";
import type { ControlledBatch, ExerciseBlueprint, ExerciseCategory } from "../src/learning/types";

function loadControlledJson<T>(url: string): T {
  const filePath = path.join(process.cwd(), url.replace(/^\//, "public/"));
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

const category: ExerciseCategory = "reading_units";
const resources = CATEGORY_RESOURCES[category];
const batch = loadControlledJson<ControlledBatch>(resources.manifestUrl);
const blueprint = loadControlledJson<ExerciseBlueprint>(resources.blueprintUrl);
const sessionId = availableSessionIdsForActiveLesson(category)[0];
assert.ok(sessionId, "Expected at least one active controlled reading session.");
const session = blueprint.sessions.find((candidate) => candidate.id === sessionId);
assert.ok(session, "Expected active session to exist in the controlled blueprint.");
assert.ok(session.interactions.length >= 2, "Expected an active session with at least two interactions.");

const [first, second] = session.interactions;
const engine = new LessonSessionEngine(new ControlledContentRepository([batch]), blueprint);
const initial = createInitialLearnerState();
const baseTime = Date.now() - 60_000;
const attemptedAt = (offsetMs: number) => new Date(baseTime + offsetMs).toISOString();

assert.throws(() => engine.record(initial, {
  itemId: second.itemId,
  sessionId,
  attemptedAt: attemptedAt(0),
  outcome: "correct",
}), /out of canonical order/);

const afterIncorrectFirst = engine.record(initial, {
  itemId: first.itemId,
  sessionId,
  attemptedAt: attemptedAt(1_000),
  outcome: "incorrect",
});
assert.equal(afterIncorrectFirst.attempts.at(-1)?.itemId, first.itemId);
assert.equal(afterIncorrectFirst.attempts.at(-1)?.outcome, "incorrect");

assert.throws(() => engine.record(afterIncorrectFirst, {
  itemId: second.itemId,
  sessionId,
  attemptedAt: attemptedAt(2_000),
  outcome: "correct",
}), /out of canonical order/);

const afterCorrectFirst = engine.record(afterIncorrectFirst, {
  itemId: first.itemId,
  sessionId,
  attemptedAt: attemptedAt(3_000),
  outcome: "correct",
});
assert.equal(afterCorrectFirst.attempts.at(-1)?.itemId, first.itemId);
assert.equal(afterCorrectFirst.attempts.at(-1)?.outcome, "correct");

assert.throws(() => engine.record(afterCorrectFirst, {
  itemId: second.itemId,
  sessionId,
  attemptedAt: attemptedAt(2_000),
  outcome: "correct",
}), /before latest learner attempt/);

const afterCorrectSecond = engine.record(afterCorrectFirst, {
  itemId: second.itemId,
  sessionId,
  attemptedAt: attemptedAt(3_000),
  outcome: "correct",
});
assert.equal(afterCorrectSecond.attempts.at(-1)?.itemId, second.itemId);
assert.equal(afterCorrectSecond.attempts.at(-1)?.outcome, "correct");
assert.equal(afterCorrectSecond.attempts.at(-1)?.attemptedAt, attemptedAt(3_000));

console.log("Canonical attempt-order and timestamp regression passed.");
