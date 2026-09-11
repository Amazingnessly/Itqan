import fs from "node:fs";

const manifestPath = "public/content/verified/s110-batch01.json";
const blueprintPath = "public/content/blueprints/units-batch01.json";
const sessionIds = ["UNITS-B01-S02", "UNITS-B01-S03"];

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, "utf8"));
const itemsById = new Map((manifest.items ?? []).map((item) => [item.id, item]));
const targetIds = new Set();

for (const sessionId of sessionIds) {
  const session = blueprint.sessions?.find((entry) => entry.id === sessionId);
  if (!session) throw new Error(`Activation session missing: ${sessionId}`);
  for (const interaction of session.interactions ?? []) targetIds.add(interaction.itemId);
}

if (targetIds.size !== 15) {
  throw new Error(`Unexpected S02/S03 controlled item set: expected 15, got ${targetIds.size}.`);
}

let newlyActivated = 0;
for (const itemId of targetIds) {
  const item = itemsById.get(itemId);
  if (!item) throw new Error(`Refusing activation of unknown item: ${itemId}`);
  if (
    item.verification?.visualPass1 !== true ||
    item.verification?.visualPass2 !== true ||
    item.verification?.ambiguous !== false ||
    item.eligibleForActiveLesson !== true ||
    !item.allowedExerciseTypes?.includes("reading_units") ||
    item.integrity?.normalizationApplied !== false ||
    typeof item.integrity?.utf8Sha256 !== "string" ||
    item.integrity.utf8Sha256.length !== 64
  ) {
    throw new Error(`Refusing to activate unsafe reading item: ${itemId}`);
  }
  if (item.active !== true) {
    item.active = true;
    newlyActivated += 1;
  }
}

if (newlyActivated !== 0 && newlyActivated !== 10) {
  throw new Error(`Unexpected activation delta: expected 10 new items or an idempotent rerun, got ${newlyActivated}.`);
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`OK: S02/S03 reading contexts safe; ${newlyActivated} new controlled items activated.`);
