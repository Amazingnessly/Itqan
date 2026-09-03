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
const blueprintIds = new Map();
const sessionIds = new Map();
for (const name of fs.readdirSync(path.join(base, blueprintDir))) {
  if (!name.endsWith(".json")) continue;
  const bp = JSON.parse(fs.readFileSync(path.join(base, blueprintDir, name), "utf8"));
  blueprints += 1;
  if (typeof bp.id !== "string" || bp.id.length === 0) {
    failures += 1;
    console.error(`FAIL ${name}: missing blueprint id`);
  } else if (blueprintIds.has(bp.id)) {
    failures += 1;
    console.error(`FAIL ${name}: duplicate blueprint id ${bp.id} also used by ${blueprintIds.get(bp.id)}`);
  } else {
    blueprintIds.set(bp.id, name);
  }
  for (const session of bp.sessions ?? []) {
    if (typeof session.id !== "string" || session.id.length === 0) {
      failures += 1;
      console.error(`FAIL ${name}: missing session id`);
    } else if (sessionIds.has(session.id)) {
      failures += 1;
      console.error(`FAIL ${name}: duplicate global session id ${session.id} also used by ${sessionIds.get(session.id)}`);
    } else {
      sessionIds.set(session.id, name);
    }
    for (const interaction of session.interactions ?? []) {
      interactions += 1;
      const item = items.get(interaction.itemId);
      if (!item) { failures += 1; console.error(`FAIL ${name}/${session.id}: unknown itemId ${interaction.itemId}`); continue; }
      if (!item.allowedExerciseTypes.includes(bp.category)) { failures += 1; console.error(`FAIL ${name}/${session.id}: ${interaction.itemId} not authorized for ${bp.category}`); }
      if (item.verification?.visualPass1 !== true || item.verification?.visualPass2 !== true || item.verification?.ambiguous !== false) {
        failures += 1; console.error(`FAIL ${name}/${session.id}: ${interaction.itemId} not fully verified`);
      }
    }
  }
}
if (failures) process.exit(1);
console.log(`OK: ${blueprints} blueprint(s), ${sessionIds.size} globally unique session(s), ${interactions} interaction(s), all references controlled and authorized.`);
