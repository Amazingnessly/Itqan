import fs from "node:fs";
import path from "node:path";
const base = process.cwd();
const manifestFiles = ["public/content/verified/s110-batch01.json", "public/content/verified/s110-batch02.json"];
const blueprintDir = "public/content/blueprints";
const items = new Map();
for (const rel of manifestFiles) {
  const payload = JSON.parse(fs.readFileSync(path.join(base, rel), "utf8"));
  for (const item of payload.items) {
    if (items.has(item.id)) { console.error(`FAIL duplicate controlled-content id: ${item.id}`); process.exit(1); }
    items.set(item.id, item);
  }
}
let interactions = 0, blueprints = 0, failures = 0;
for (const name of fs.readdirSync(path.join(base, blueprintDir))) {
  if (!name.endsWith(".json")) continue;
  const bp = JSON.parse(fs.readFileSync(path.join(base, blueprintDir, name), "utf8"));
  blueprints += 1;
  for (const session of bp.sessions ?? []) for (const interaction of session.interactions ?? []) {
    interactions += 1;
    const item = items.get(interaction.itemId);
    if (!item) { failures += 1; console.error(`FAIL ${name}/${session.id}: unknown itemId ${interaction.itemId}`); continue; }
    if (!item.allowedExerciseTypes.includes(bp.category)) { failures += 1; console.error(`FAIL ${name}/${session.id}: ${interaction.itemId} not authorized for ${bp.category}`); }
    if (item.verification?.visualPass1 !== true || item.verification?.visualPass2 !== true || item.verification?.ambiguous !== false) {
      failures += 1; console.error(`FAIL ${name}/${session.id}: ${interaction.itemId} not fully verified`);
    }
  }
}
if (failures) process.exit(1);
console.log(`OK: ${blueprints} blueprint(s), ${interactions} interaction(s), all references controlled and authorized.`);
