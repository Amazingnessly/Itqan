import fs from "node:fs";
import crypto from "node:crypto";

const manifestPath =
  process.argv[2] ?? "public/content/verified/s110-batch01.json";

const payload = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

let failures = 0;

for (const item of payload.items) {
  const errors = [];

  if (!item.arabicExact) errors.push("missing arabicExact");
  if (item.verification?.visualPass1 !== true) errors.push("visualPass1 != true");
  if (item.verification?.visualPass2 !== true) errors.push("visualPass2 != true");
  if (item.verification?.ambiguous !== false) errors.push("ambiguous != false");
  if (item.integrity?.normalizationApplied !== false)
    errors.push("normalizationApplied must be false");

  const digest = crypto
    .createHash("sha256")
    .update(item.arabicExact, "utf8")
    .digest("hex");

  if (digest !== item.integrity?.utf8Sha256)
    errors.push("UTF-8 integrity checksum mismatch");

  if (!Array.isArray(item.allowedExerciseTypes) || !item.allowedExerciseTypes.length)
    errors.push("no authorized exercise type");

  if (item.active === true && item.eligibleForActiveLesson !== true)
    errors.push("active item must be eligibleForActiveLesson");

  if (errors.length) {
    failures++;
    console.error(`FAIL ${item.id}: ${errors.join("; ")}`);
  }
}

if (failures) {
  console.error(`\n${failures} controlled-content item(s) failed validation.`);
  process.exit(1);
}

console.log(
  `OK: ${payload.items.length} controlled Arabic item(s) passed integrity and verification checks.`
);
