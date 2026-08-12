import fs from "node:fs";

const manifest = JSON.parse(
  fs.readFileSync("public/content/verified/s110-batch01.json", "utf8")
);
const blueprint = JSON.parse(
  fs.readFileSync("public/content/blueprints/units-batch01.json", "utf8")
);

const session = blueprint.sessions.find((entry) => entry.id === "UNITS-B01-S01");
if (!session) throw new Error("UNITS-B01-S01 missing.");

let failures = 0;

for (const interaction of session.interactions) {
  const item = manifest.items.find((entry) => entry.id === interaction.itemId);

  if (!item) {
    console.error(`FAIL unknown item ${interaction.itemId}`);
    failures += 1;
    continue;
  }

  if (
    item.active !== true ||
    item.verification?.visualPass1 !== true ||
    item.verification?.visualPass2 !== true ||
    item.verification?.ambiguous !== false ||
    !item.allowedExerciseTypes.includes("reading_units")
  ) {
    console.error(`FAIL unsafe pilot item ${item.id}`);
    failures += 1;
  }
}

if (failures) process.exit(1);

console.log(
  `OK: pilot session ${session.id} contains ${session.interactions.length} active, double-verified reading items.`
);
