import fs from "node:fs";

const manifestPath = "public/content/verified/s110-batch02.json";
const blueprintPath = "public/content/blueprints/shaddah-batch02.json";
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, "utf8"));
const expectedSessions = ["SHADDAH-B02-S01", "SHADDAH-B02-S02", "SHADDAH-B02-S03"];

if (blueprint.category !== "shaddah") throw new Error("Unexpected blueprint category.");
if (JSON.stringify(blueprint.sessions.slice(0, 3).map((session) => session.id)) !== JSON.stringify(expectedSessions)) {
  throw new Error("Shaddah S01-S03 session prefix changed; refusing automatic activation.");
}
if (blueprint.unlockPolicy?.timingOnlyAfterPrecisionStability !== true) {
  throw new Error("Shaddah blueprint must require precision stability before timing.");
}

const targetIds = [...new Set(
  blueprint.sessions.slice(0, 3).flatMap((session) => session.interactions.map((interaction) => interaction.itemId)),
)];
if (targetIds.length !== 16) throw new Error(`Unexpected shaddah S01-S03 item set size: ${targetIds.length}.`);

const verifiedPages = new Set(manifest.sourceControl?.verifiedPdfPages ?? []);
const items = new Map((manifest.items ?? []).map((item) => [item.id, item]));
const protectedSnapshots = new Map((manifest.items ?? []).map((item) => {
  const { active, ...protectedFields } = item;
  return [item.id, JSON.stringify(protectedFields)];
}));
let changed = 0;

for (const itemId of targetIds) {
  const item = items.get(itemId);
  if (!item) throw new Error(`Missing controlled item: ${itemId}.`);
  if (item.source?.sourceId !== manifest.sourceControl?.canonicalSourceId) throw new Error(`Non-canonical source: ${itemId}.`);
  if (!verifiedPages.has(item.source?.pdfPage)) throw new Error(`Unverified source page: ${itemId}.`);
  if (item.verification?.visualPass1 !== true || item.verification?.visualPass2 !== true || item.verification?.ambiguous !== false) {
    throw new Error(`Item lacks two unambiguous visual passes: ${itemId}.`);
  }
  if (item.eligibleForActiveLesson !== true) throw new Error(`Item is not eligible: ${itemId}.`);
  if (!item.allowedExerciseTypes?.includes("shaddah")) throw new Error(`Item is not authorized for shaddah: ${itemId}.`);
  if (item.integrity?.normalizationApplied !== false) throw new Error(`Normalization detected: ${itemId}.`);
  if (typeof item.integrity?.utf8Sha256 !== "string" || item.integrity.utf8Sha256.length !== 64) {
    throw new Error(`Invalid checksum: ${itemId}.`);
  }
  if (item.active !== true) {
    item.active = true;
    changed += 1;
  }
}

for (const item of manifest.items ?? []) {
  const { active, ...protectedFields } = item;
  if (JSON.stringify(protectedFields) !== protectedSnapshots.get(item.id)) {
    throw new Error(`Protected controlled-content fields changed for ${item.id}.`);
  }
}

if (changed !== 0 && changed !== 11) throw new Error(`Unexpected shaddah activation delta: ${changed}; expected 11 or 0.`);
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`OK: shaddah S01-S03 use ${targetIds.length} safe controlled items; ${changed} newly activated.`);
