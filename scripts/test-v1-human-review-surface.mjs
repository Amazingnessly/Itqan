import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildHumanReviewSurface } from "./generate-v1-human-review-surface.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedPath = path.join(root, "docs/generated/V1_HUMAN_REVIEW_SURFACE.md");
const result = buildHumanReviewSurface();

assert.equal(result.sessionCount, 21);
assert.equal(result.interactionCount, 186);
assert.ok(result.uniqueItemCount > 0);
assert.equal(result.text, fs.readFileSync(generatedPath, "utf8"), "the committed review surface must be current");

const sessionHeadings = result.text.match(/^## [A-Z][A-Z0-9_-]+$/gm) ?? [];
const interactionRows = result.text.match(/^\| \d+ \| `[^`]+` \| `S110-P\d{3}-\d{3}` \|/gm) ?? [];
assert.equal(sessionHeadings.length, 21);
assert.equal(interactionRows.length, 186);
assert.match(result.text, /3 — article_al \(qamariyyah\)/);
assert.match(result.text, /5 — article_al \(shamsiyyah\)/);
assert.match(result.text, /<bdi dir="rtl" lang="ar">/);

console.log("V1 exhaustive human-review surface regressions passed.");
