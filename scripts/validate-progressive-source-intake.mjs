import fs from "node:fs";

const registryPath = "public/content/source-intake/progressive-support.json";
const planPath = "public/content/curriculum/progressive-foundation.json";
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
const arabicPattern = /[\u0600-\u06ff]/u;

const expectedSequenced = [
  "fathah",
  "kasrah",
  "dammah",
  "mixed_short_vowels",
  "madd_alif",
  "madd_ya",
  "madd_waw",
  "mixed_madd",
  "tanwin_damm",
  "sukun",
];

if (registry.schemaVersion !== "0.1") throw new Error("Unsupported progressive source-intake schema.");
if (registry.status !== "source_intake_complete_pending_controlled_transcription") {
  throw new Error("Progressive source intake must remain gated pending controlled transcription.");
}
if (arabicPattern.test(JSON.stringify(registry))) {
  throw new Error("Progressive source-intake registry must not embed Arabic exercise content.");
}
if (registry.rules?.agentMayTranscribeArabicFromImages !== false) {
  throw new Error("Agents must remain forbidden from transcribing Arabic from source images.");
}
if (registry.rules?.exactArabicRequiresHumanControlledEntry !== true) {
  throw new Error("Exact Arabic must require controlled human entry.");
}
if (registry.rules?.activationRequiresRepositoryBackedEvidence !== true) {
  throw new Error("Activation must require repository-backed source evidence.");
}

const sequenced = (registry.modules ?? [])
  .filter((entry) => Number.isInteger(entry.sequence))
  .sort((a,b) => a.sequence - b.sequence);
if (JSON.stringify(sequenced.map((entry) => entry.id)) !== JSON.stringify(expectedSequenced)) {
  throw new Error("Progressive source module sequence does not match the approved human sequence.");
}
for (const entry of sequenced) {
  if (!Array.isArray(entry.sourceAssets) || entry.sourceAssets.length === 0) {
    throw new Error(`Missing source assets for ${entry.id}.`);
  }
  if (entry.sourceAssets.some((asset) => typeof asset !== "string" || !/^IMG_[0-9]+(?:\(1\))?\.jpeg$/.test(asset))) {
    throw new Error(`Invalid source-asset reference for ${entry.id}.`);
  }
}
const byId = new Map((registry.modules ?? []).map((entry) => [entry.id, entry]));
if (byId.get("tanwin_damm")?.targetCategory !== "vowels_sukun") {
  throw new Error("Tanwin Damm must be assigned to vowels_sukun.");
}
if (byId.get("sukun")?.targetCategory !== "vowels_sukun") {
  throw new Error("Sukun must be assigned to vowels_sukun.");
}
if (byId.get("two_words")?.targetCategory !== "linking" || byId.get("two_words")?.activation !== "deferred_until_linking") {
  throw new Error("Two-word source material must remain deferred to linking.");
}
if (byId.get("long_reading")?.targetCategory !== "fluent_reading" || byId.get("long_reading")?.activation !== "deferred_until_fluent_reading") {
  throw new Error("Long-reading source material must remain deferred to fluent_reading.");
}
if (plan.status !== registry.status) {
  throw new Error("Progressive curriculum and source-intake statuses must agree.");
}
if (plan.controlledTranscriptionGate?.status !== "blocked_until_human_exact_entry") {
  throw new Error("Controlled transcription gate must remain closed.");
}
console.log("OK: complete progressive source intake is recorded without bypassing controlled Arabic transcription.");
