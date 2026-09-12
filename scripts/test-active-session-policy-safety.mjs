import assert from "node:assert/strict";
import fs from "node:fs";
import { validateActiveSessionPolicy } from "./active-session-policy.mjs";

const activation = JSON.parse(fs.readFileSync("public/content/activation/active-sessions.json", "utf8"));
const manifest = JSON.parse(fs.readFileSync("public/content/verified/s110-batch01.json", "utf8"));
const blueprint = JSON.parse(fs.readFileSync("public/content/blueprints/units-batch01.json", "utf8"));
const category = "reading_units";

function validate(overrides = {}) {
  return validateActiveSessionPolicy({ category, blueprint, manifest, activation, ...overrides });
}

assert.doesNotThrow(() => validate());

{
  const unsafeActivation = structuredClone(activation);
  unsafeActivation.schemaVersion = "unsafe-version";
  assert.throws(
    () => validate({ activation: unsafeActivation }),
    /Unsupported active-session schema/,
  );
}

{
  const unsafeActivation = structuredClone(activation);
  const active = unsafeActivation[category];
  assert.ok(Array.isArray(active) && active.length >= 3);
  unsafeActivation[category] = [active[0], active[2]];
  assert.throws(
    () => validate({ activation: unsafeActivation }),
    /contiguous prefix/,
  );
}

const firstSessionId = activation[category][0];
const firstSession = blueprint.sessions.find((session) => session.id === firstSessionId);
assert.ok(firstSession?.interactions?.length);
const firstItemId = firstSession.interactions[0].itemId;

function mutatedManifest(mutator) {
  const unsafe = structuredClone(manifest);
  const item = unsafe.items.find((candidate) => candidate.id === firstItemId);
  assert.ok(item);
  mutator(item, unsafe);
  return unsafe;
}

{
  const unsafe = mutatedManifest((item) => {
    item.verification.visualPass2 = false;
  });
  assert.throws(() => validate({ manifest: unsafe }), /Unsafe active item/);
}

{
  const unsafe = mutatedManifest((item) => {
    item.allowedExerciseTypes = item.allowedExerciseTypes.filter((value) => value !== category);
  });
  assert.throws(() => validate({ manifest: unsafe }), /Unsafe active item/);
}

{
  const unsafe = mutatedManifest((item) => {
    item.integrity.normalizationApplied = true;
  });
  assert.throws(() => validate({ manifest: unsafe }), /Unsafe active item/);
}

{
  const unsafe = mutatedManifest((item, batch) => {
    const verifiedPages = new Set(batch.sourceControl?.verifiedPdfPages ?? []);
    let unverifiedPage = 1;
    while (verifiedPages.has(unverifiedPage)) unverifiedPage += 1;
    item.source.pdfPage = unverifiedPage;
  });
  assert.throws(() => validate({ manifest: unsafe }), /Unsafe active item/);
}

console.log("Active-session policy safety regressions passed.");