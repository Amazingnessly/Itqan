import fs from "node:fs";

const manifestPath = "public/content/verified/s110-batch02.json";
const blueprintPath = "public/content/blueprints/vowels_sukun-batch02.json";
const sessionIds = [
  "VOWELS_SUKUN-B02-S01",
  "VOWELS_SUKUN-B02-S02",
  "VOWELS_SUKUN-B02-S03",
];

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, "utf8"));
const itemsById = new Map((manifest.items ?? []).map((item) => [item.id, item]));
const targetIds = new Set();

for (const sessionId of sessionIds) {
  const session = blueprint.sessions?.find((entry) => entry.id === sessionId);
  if (!session) throw new Error(`Activation session missing: ${sessionId}`);
  for (const interaction of session.interactions ?? []) targetIds.add(interaction.itemId);
}

if (targetIds.size !== 16) {
  throw new Error(`Unexpected S01-S03 vowels/sukun item set: expected 16, got ${targetIds.size}.`);
}

const verifiedPages = new Set(manifest.sourceControl?.verifiedPdfPages ?? []);
let newlyActivated = 0;
for (const itemId of targetIds) {
  const item = itemsById.get(itemId);
  if (!item) throw new Error(`Refusing activation of unknown item: ${itemId}`);
  if (
    item.source?.sourceId !== manifest.sourceControl?.canonicalSourceId ||
    !verifiedPages.has(item.source?.pdfPage) ||
    item.verification?.visualPass1 !== true ||
    item.verification?.visualPass2 !== true ||
    item.verification?.ambiguous !== false ||
    item.eligibleForActiveLesson !== true ||
    !item.allowedExerciseTypes?.includes("vowels_sukun") ||
    item.integrity?.normalizationApplied !== false ||
    typeof item.integrity?.utf8Sha256 !== "string" ||
    item.integrity.utf8Sha256.length !== 64
  ) {
    throw new Error(`Refusing to activate unsafe vowels/sukun item: ${itemId}`);
  }
  if (item.active !== true) {
    item.active = true;
    newlyActivated += 1;
  }
}

if (newlyActivated !== 0 && newlyActivated !== 16) {
  throw new Error(`Unexpected activation delta: expected 16 new items or an idempotent rerun, got ${newlyActivated}.`);
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`OK: vowels/sukun S01-S03 safe; ${newlyActivated} new controlled items activated.`);
