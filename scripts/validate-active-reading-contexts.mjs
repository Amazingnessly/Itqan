import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("public/content/verified/s110-batch01.json", "utf8"));
const blueprint = JSON.parse(fs.readFileSync("public/content/blueprints/units-batch01.json", "utf8"));
const activation = JSON.parse(fs.readFileSync("public/content/activation/active-sessions.json", "utf8"));
const items = new Map((manifest.items ?? []).map((item) => [item.id, item]));
const expectedActiveSessions = ["UNITS-B01-S01", "UNITS-B01-S02", "UNITS-B01-S03"];

function isSafeActiveReadingItem(item) {
  return item?.active === true
    && item?.verification?.visualPass1 === true
    && item?.verification?.visualPass2 === true
    && item?.verification?.ambiguous === false
    && item?.eligibleForActiveLesson === true
    && item?.allowedExerciseTypes?.includes("reading_units")
    && item?.integrity?.normalizationApplied === false
    && typeof item?.integrity?.utf8Sha256 === "string"
    && item.integrity.utf8Sha256.length === 64;
}

const allowlisted = activation.reading_units;
if (!Array.isArray(allowlisted) || JSON.stringify(allowlisted) !== JSON.stringify(expectedActiveSessions)) {
  throw new Error(`Unexpected reading session activation policy: ${JSON.stringify(allowlisted)}.`);
}

for (const sessionId of expectedActiveSessions) {
  const session = blueprint.sessions.find((entry) => entry.id === sessionId);
  if (!session) throw new Error(`Missing expected active reading session: ${sessionId}`);
  if (!(session.interactions ?? []).length) throw new Error(`Empty active reading session: ${sessionId}`);
  for (const interaction of session.interactions) {
    const item = items.get(interaction.itemId);
    if (!isSafeActiveReadingItem(item)) throw new Error(`Unsafe active reading item: ${interaction.itemId}`);
  }
}

for (const sessionId of ["UNITS-B01-S04", "UNITS-B01-S09", "UNITS-B01-S10"]) {
  if (allowlisted.includes(sessionId)) {
    throw new Error(`${sessionId} must remain unavailable until explicitly session-activated.`);
  }
}

console.log("OK: only S01-S03 are explicitly session-activated and every referenced reading item is safe.");
