import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("public/content/verified/s110-batch01.json", "utf8"));
const blueprint = JSON.parse(fs.readFileSync("public/content/blueprints/units-batch01.json", "utf8"));
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

function isSessionActive(session) {
  return (session.interactions ?? []).length > 0
    && session.interactions.every((interaction) => isSafeActiveReadingItem(items.get(interaction.itemId)));
}

const activeSessionIds = (blueprint.sessions ?? []).filter(isSessionActive).map((session) => session.id);
if (JSON.stringify(activeSessionIds) !== JSON.stringify(expectedActiveSessions)) {
  throw new Error(`Unexpected active reading sessions: ${activeSessionIds.join(", ") || "none"}.`);
}

for (const sessionId of expectedActiveSessions) {
  const session = blueprint.sessions.find((entry) => entry.id === sessionId);
  if (!session) throw new Error(`Missing expected active reading session: ${sessionId}`);
  for (const interaction of session.interactions) {
    const item = items.get(interaction.itemId);
    if (!isSafeActiveReadingItem(item)) throw new Error(`Unsafe active reading item: ${interaction.itemId}`);
  }
}

const nextSession = blueprint.sessions.find((entry) => entry.id === "UNITS-B01-S04");
if (!nextSession || isSessionActive(nextSession)) {
  throw new Error("UNITS-B01-S04 must remain unavailable until its controlled items are explicitly activated.");
}

console.log("OK: exactly S01-S03 are active, double-verified reading contexts; S04 remains blocked.");
