import fs from "node:fs";

const manifestPath = "public/content/verified/s110-batch01.json";
const blueprintPath = "public/content/blueprints/units-batch01.json";

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, "utf8"));

const session = blueprint.sessions.find((entry) => entry.id === "UNITS-B01-S01");
if (!session) throw new Error("Pilot session UNITS-B01-S01 not found.");

const ids = new Set(session.interactions.map((entry) => entry.itemId));
let activated = 0;

for (const item of manifest.items) {
  if (!ids.has(item.id)) continue;

  if (
    item.verification?.visualPass1 !== true ||
    item.verification?.visualPass2 !== true ||
    item.verification?.ambiguous !== false ||
    item.eligibleForActiveLesson !== true ||
    !item.allowedExerciseTypes?.includes("reading_units")
  ) {
    throw new Error(`Refusing to activate unsafe item: ${item.id}`);
  }

  item.active = true;
  activated += 1;
}

if (activated !== ids.size) {
  throw new Error(
    `Activation mismatch: expected ${ids.size} controlled items, activated ${activated}.`
  );
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`OK: ${activated} verified items activated for pilot session UNITS-B01-S01.`);
