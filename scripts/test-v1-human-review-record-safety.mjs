import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateHumanReviewRecord } from "./validate-v1-human-review-record.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const activation = JSON.parse(fs.readFileSync(path.join(root, "public/content/activation/active-sessions.json"), "utf8"));
const reviewText = fs.readFileSync(path.join(root, "docs/V1_ARABIC_HUMAN_REVIEW.md"), "utf8");
const firstRow = "| `reading_units` | `UNITS-B01-S01` | `public/content/blueprints/units-batch01.json` | `public/content/verified/s110-batch01.json` | `PENDING QUALIFIED HUMAN REVIEW` | `PENDING` |";

const baseline = validateHumanReviewRecord({ activation, reviewText });
assert.equal(baseline.total, 21);
assert.equal(baseline.pending, 21);
assert.throws(
  () => validateHumanReviewRecord({ activation, reviewText, requireComplete: true }),
  /still await qualified human review/,
);

const completedFirstRow = reviewText
  .replace("- Release candidate SHA: `PENDING`", `- Release candidate SHA: \`${"a".repeat(40)}\``)
  .replace("- Reviewer name or traceable reviewer ID: `PENDING`", "- Reviewer name or traceable reviewer ID: `reviewer-1`")
  .replace("- Reviewer qualification/context relevant to Arabic reading instruction: `PENDING`", "- Reviewer qualification/context relevant to Arabic reading instruction: `qualified-context`")
  .replace("- Review date: `PENDING`", "- Review date: `2026-09-21`")
  .replace(firstRow, firstRow.replace("`PENDING QUALIFIED HUMAN REVIEW` | `PENDING`", "`VERIFIED BY QUALIFIED HUMAN` | `review-evidence-1`"));
assert.throws(
  () => validateHumanReviewRecord({
    activation,
    reviewText: completedFirstRow,
    missingEvidenceSessions: ["reading_units:UNITS-B01-S01"],
  }),
  /cannot be verified while required visual-evidence links are missing/,
);

assert.ok(reviewText.includes(firstRow));

assert.throws(
  () => validateHumanReviewRecord({ activation, reviewText: reviewText.replace(`${firstRow}\n`, "") }),
  /missing active session review row/,
);

assert.throws(
  () => validateHumanReviewRecord({ activation, reviewText: reviewText.replace(firstRow, `${firstRow}\n${firstRow}`) }),
  /duplicate review row/,
);

assert.throws(
  () => validateHumanReviewRecord({
    activation,
    reviewText: reviewText.replace(
      "`PENDING QUALIFIED HUMAN REVIEW` | `PENDING` |",
      "`VERIFIED BY QUALIFIED HUMAN` | `PENDING` |",
    ),
  }),
  /requires a traceable evidence\/correction reference/,
);

const activationWithDrift = structuredClone(activation);
activationWithDrift.reading_units = [...activationWithDrift.reading_units, "UNITS-B01-S99"];
assert.throws(
  () => validateHumanReviewRecord({ activation: activationWithDrift, reviewText }),
  /missing active session review row/,
);

console.log("V1 human-review record safety regressions passed.");
