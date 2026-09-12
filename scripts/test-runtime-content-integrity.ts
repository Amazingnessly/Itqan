import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { availableSessionIdsForActiveLesson } from "../src/learning/attemptRegistry.generated";
import { CATEGORY_RESOURCES } from "../src/learning/categoryCatalog";
import { sha256Utf8 } from "../src/learning/contentIntegrity";
import { ControlledContentRepository } from "../src/learning/contentRepository";
import type { ControlledBatch, ExerciseBlueprint, ExerciseCategory } from "../src/learning/types";

function loadControlledJson<T>(url: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), url.replace(/^\//, "public/")), "utf8")) as T;
}

assert.equal(
  sha256Utf8("abc"),
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
);

const category: ExerciseCategory = "reading_units";
const resources = CATEGORY_RESOURCES[category];
const batch = loadControlledJson<ControlledBatch>(resources.manifestUrl);
const blueprint = loadControlledJson<ExerciseBlueprint>(resources.blueprintUrl);
const sessionId = availableSessionIdsForActiveLesson(category)[0];
assert.ok(sessionId);
const session = blueprint.sessions.find((candidate) => candidate.id === sessionId);
assert.ok(session?.interactions.length);
const itemId = session.interactions[0].itemId;
const canonicalItem = batch.items.find((item) => item.id === itemId);
assert.ok(canonicalItem);
assert.equal(sha256Utf8(canonicalItem.arabicExact), canonicalItem.integrity.utf8Sha256);

const canonicalRepository = new ControlledContentRepository([batch]);
assert.equal(canonicalRepository.resolve(itemId, category).id, itemId);

function mutatedBatch(mutator: (item: ControlledBatch["items"][number]) => void): ControlledBatch {
  const mutated = structuredClone(batch);
  const item = mutated.items.find((candidate) => candidate.id === itemId);
  assert.ok(item);
  mutator(item);
  return mutated;
}

{
  const mutated = mutatedBatch((item) => {
    item.arabicExact = `${item.arabicExact}x`;
  });
  const repository = new ControlledContentRepository([mutated]);
  assert.throws(
    () => repository.resolve(itemId, category),
    /UTF-8 integrity mismatch blocked/,
  );
}

{
  const mutated = mutatedBatch((item) => {
    item.integrity.utf8Sha256 = "0".repeat(64);
  });
  const repository = new ControlledContentRepository([mutated]);
  assert.throws(
    () => repository.resolve(itemId, category),
    /metadata mismatch blocked/,
  );
}

{
  const mutated = mutatedBatch((item) => {
    item.source.sourceId = `${item.source.sourceId}-mismatch`;
  });
  const repository = new ControlledContentRepository([mutated]);
  assert.throws(
    () => repository.resolve(itemId, category),
    /metadata mismatch blocked/,
  );
}

{
  const mutated = mutatedBatch((item) => {
    item.source.pdfPage += 1;
  });
  const repository = new ControlledContentRepository([mutated]);
  assert.throws(
    () => repository.resolve(itemId, category),
    /metadata mismatch blocked/,
  );
}

console.log("Runtime controlled-content integrity tests passed.");
