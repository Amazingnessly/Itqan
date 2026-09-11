import fs from "node:fs";

const manifestPath = "public/content/verified/s110-batch02.json";
const blueprintPath = "public/content/blueprints/article_al-batch02.json";
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, "utf8"));
const expectedSessions = ["ARTICLE_AL-B02-S01", "ARTICLE_AL-B02-S02", "ARTICLE_AL-B02-S03"];

if (blueprint.category !== "article_al") throw new Error("Unexpected blueprint category.");
if (JSON.stringify(blueprint.sessions.slice(0, 3).map((session) => session.id)) !== JSON.stringify(expectedSessions)) {
  throw new Error("Article AL S01-S03 session prefix changed; refusing automatic activation.");
}
if (blueprint.unlockPolicy?.timingOnlyAfterPrecisionStability !== true) {
  throw new Error("Article AL blueprint must require precision stability before timing.");
}

const targetIds = [...new Set(
  blueprint.sessions.slice(0, 3).flatMap((session) => session.interactions.map((interaction) => interaction.itemId)),
)];
if (targetIds.length !== 16) throw new Error(`Unexpected article AL S01-S03 item set size: ${targetIds.length}.`);

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
  if (!item.allowedExerciseTypes?.includes("article_al")) throw new Error(`Item is not authorized for article_al: ${itemId}.`);
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

if (changed !== 0 && changed !== 4) throw new Error(`Unexpected article AL activation delta: ${changed}; expected 4 or 0.`);
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`OK: article AL S01-S03 use ${targetIds.length} safe controlled items; ${changed} newly activated.`);
