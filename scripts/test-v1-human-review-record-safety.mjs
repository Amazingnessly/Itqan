import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateHumanReviewRecord } from "./validate-v1-human-review-record.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const activation = JSON.parse(fs.readFileSync(path.join(root, "public/content/activation/active-sessions.json"), "utf8"));
const reviewText = fs.readFileSync(path.join(root, "docs/V1_ARABIC_HUMAN_REVIEW.md"), "utf8");

const baseline = validateHumanReviewRecord({ activation, reviewText });
assert.equal(baseline.total, 18);
assert.equal(baseline.pending, 18);
assert.throws(
  () => validateHumanReviewRecord({ activation, reviewText, requireComplete: true }),
  /still await qualified human review/,
);

const firstRow = "| `reading_units` | `UNITS-B01-S01` | `public/content/blueprints/units-batch01.json` | `public/content/verified/s110-batch01.json` | `PENDING QUALIFIED HUMAN REVIEW` | `PENDING` |";
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
