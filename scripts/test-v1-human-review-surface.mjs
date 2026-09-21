import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildHumanReviewSurface } from "./generate-v1-human-review-surface.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedPath = path.join(root, "docs/generated/V1_HUMAN_REVIEW_SURFACE.md");
const result = buildHumanReviewSurface();

function buildWithMutation(relativePath, mutate) {
  return buildHumanReviewSurface({
    loadJson(candidatePath) {
      const value = JSON.parse(fs.readFileSync(path.join(root, candidatePath), "utf8"));
      if (candidatePath === relativePath) mutate(value);
      return value;
    },
  });
}

assert.equal(result.sessionCount, 21);
assert.equal(result.interactionCount, 186);
assert.ok(result.uniqueItemCount > 0);
assert.equal(result.missingEvidenceItemCount, 3);
assert.deepEqual(result.missingEvidenceSessions.sort(), [
  "reading_units:UNITS-B01-S01",
  "reading_units:UNITS-B01-S02",
  "reading_units:UNITS-B01-S03",
]);
assert.equal(result.text, fs.readFileSync(generatedPath, "utf8"), "the committed review surface must be current");

const sessionHeadings = result.text.match(/^## [A-Z][A-Z0-9_-]+$/gm) ?? [];
const interactionRows = result.text.match(/^\| \d+ \| `[^`]+` \| `S110-P\d{3}-\d{3}` \|/gm) ?? [];
assert.equal(sessionHeadings.length, 21);
assert.equal(interactionRows.length, 186);
assert.match(result.text, /3 — article_al \(qamariyyah\)/);
assert.match(result.text, /5 — article_al \(shamsiyyah\)/);
assert.match(result.text, /<bdi dir="rtl" lang="ar">/);

const sessionIds = sessionHeadings.map((heading) => heading.slice(3));
assert.equal(new Set(sessionIds).size, 21, "every active session must appear exactly once");

const rows = result.text.split("\n").filter((line) => /^\| \d+ \|/.test(line));
for (const row of rows) {
  const links = row.match(/\[(?:page|zoom)\]\(\.\.\/\.\.\/public\/content\/[^)]+\)/g) ?? [];
  const blocked = row.includes("PREUVES VISUELLES MANQUANTES — REVUE BLOQUÉE");
  assert.ok(links.length === 2 || blocked, "each interaction must expose both evidence links or an explicit blocker");
  assert.ok(!(links.length && blocked), "an interaction cannot be linked and blocked at the same time");
}
assert.match(result.text, /3 items bloqués faute de liens/);

assert.throws(
  () => buildWithMutation("public/content/activation/active-sessions.json", (activation) => {
    activation.reading_units.push(activation.reading_units[0]);
  }),
  /Duplicate active session/,
);
assert.throws(
  () => buildWithMutation("public/content/activation/active-sessions.json", (activation) => {
    activation.article_al.push("ARTICLE_AL-B02-S99");
  }),
  /Review coverage mismatch/,
);
assert.throws(
  () => buildWithMutation("public/content/verified/s110-batch01.json", (manifest) => {
    manifest.items[0].integrity.utf8Sha256 = "0".repeat(64);
  }),
  /integrity hash mismatch/,
);
assert.throws(
  () => buildWithMutation("public/content/blueprints/units-batch01.json", (blueprint) => {
    blueprint.sessions.push(structuredClone(blueprint.sessions[0]));
  }),
  /duplicate id/,
);
assert.throws(
  () => buildWithMutation("public/content/verified/s110-batch02.json", (manifest) => {
    manifest.items[0].verification.evidence.crop = manifest.items[0].verification.evidence.full;
  }),
  /distinct page and zoom evidence/,
);

console.log("V1 exhaustive human-review surface regressions passed.");
