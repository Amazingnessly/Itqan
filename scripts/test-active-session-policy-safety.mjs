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
  const unsafeBlueprint = structuredClone(blueprint);
  unsafeBlueprint.sessions[0].interactions[1].itemId = unsafeBlueprint.sessions[0].interactions[0].itemId;
  assert.throws(
    () => validate({ blueprint: unsafeBlueprint }),
    /repeats a foundation item before Fluidifier/,
  );
}

{
  const unsafeBlueprint = structuredClone(blueprint);
  unsafeBlueprint.sessions[0].interactions = unsafeBlueprint.sessions[0].interactions.slice(0, 3);
  unsafeBlueprint.sessions[0].interactionCount = 3;
  assert.throws(
    () => validate({ blueprint: unsafeBlueprint }),
    /must contain exactly 4 method interactions/,
  );
}

{
  const unsafeBlueprint = structuredClone(blueprint);
  unsafeBlueprint.sessions[0].interactions[0].mode = "oral_read";
  assert.throws(
    () => validate({ blueprint: unsafeBlueprint }),
    /must follow Voir -> Decomposer -> Prononcer -> Fluidifier/,
  );
}

{
  const unsafeBlueprint = structuredClone(blueprint);
  unsafeBlueprint.sessions[0].interactions[3].itemId = "S110-P003-004";
  assert.throws(
    () => validate({ blueprint: unsafeBlueprint }),
    /Fluidifier must revisit exactly one already-seen foundation item/,
  );
}

for (const excludedItemId of ["S110-P003-004", "S110-P003-007"]) {
  const unsafeBlueprint = structuredClone(blueprint);
  unsafeBlueprint.sessions[0].interactions[0].itemId = excludedItemId;
  assert.throws(
    () => validate({ blueprint: unsafeBlueprint }),
    /outside the explicit foundation item set/,
  );
}

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

{
  const unsafe = mutatedManifest((item) => {
    item.articleClassObserved = ["qamariyyah"];
  });
  assert.throws(() => validate({ manifest: unsafe }), /article behavior before the article stage/);
}

{
  const unsafe = mutatedManifest((item) => {
    item.focusMarksObserved = [...(item.focusMarksObserved ?? []), "shaddah"];
  });
  assert.throws(() => validate({ manifest: unsafe }), /shaddah before the shaddah stage/);
}

const articleCategory = "article_al";
const articleManifest = JSON.parse(fs.readFileSync("public/content/verified/s110-batch02.json", "utf8"));
const articleBlueprint = JSON.parse(fs.readFileSync("public/content/blueprints/article_al-batch02.json", "utf8"));

function validateArticle(overrides = {}) {
  return validateActiveSessionPolicy({
    category: articleCategory,
    blueprint: articleBlueprint,
    manifest: articleManifest,
    activation,
    ...overrides,
  });
}

assert.doesNotThrow(() => validateArticle());

{
  const unsafe = structuredClone(articleBlueprint);
  unsafe.sessions[0].interactions[0].itemId = "S110-P007-007";
  assert.throws(() => validateArticle({ blueprint: unsafe }), /not qamariyyah-only/);
}

{
  const unsafe = structuredClone(articleBlueprint);
  unsafe.sessions[3].interactions[0].itemId = "S110-P007-004";
  assert.throws(() => validateArticle({ blueprint: unsafe }), /not shamsiyyah-only/);
}

{
  const unsafe = structuredClone(articleManifest);
  const shamsItemId = articleBlueprint.sessions[3].interactions[0].itemId;
  const item = unsafe.items.find((candidate) => candidate.id === shamsItemId);
  assert.ok(item);
  item.focusMarksObserved = (item.focusMarksObserved ?? []).filter((mark) => mark !== "shaddah");
  assert.throws(() => validateArticle({ manifest: unsafe }), /lacks the observed shaddah/);
}

console.log("Active-session policy safety regressions passed.");
