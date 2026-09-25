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
  "tanwin_fath",
  "tanwin_kasr",
  "tanwin_damm",
  "sukun",
];

if (registry.schemaVersion !== "0.2") throw new Error("Unsupported progressive source-intake schema.");
if (registry.status !== "canonical_pdf_received_pending_candidate_transcription_and_human_verification") {
  throw new Error("Progressive source intake must remain gated pending human verification.");
}
if (arabicPattern.test(JSON.stringify(registry))) {
  throw new Error("Progressive source-intake registry must not embed Arabic exercise content.");
}
if (registry.rules?.agentMayCreateProvisionalTranscriptionCandidatesFromImages !== true) {
  throw new Error("The verification-first workflow must allow non-authoritative provisional candidates.");
}
if (registry.rules?.provisionalCandidatesAreAuthoritative !== false) {
  throw new Error("Provisional transcription candidates must never be authoritative.");
}
if (registry.rules?.humanTypingRequired !== false || registry.rules?.humanVisualVerificationRequired !== true) {
  throw new Error("Human work must be verification-first rather than mandatory retyping.");
}
if (registry.rules?.visualVerificationPassesRequired !== 2) {
  throw new Error("Two visual verification passes are required.");
}
if (registry.rules?.activationRequiresRepositoryBackedEvidence !== true) {
  throw new Error("Activation must require repository-backed source evidence.");
}
if (registry.rules?.ocrOrModelOutputMayNotBePromotedWithoutHumanVerification !== true) {
  throw new Error("Machine/model output must not be promotable without human verification.");
}

const source = registry.sourceDocument;
if (!source || source.id !== "ISCSM-TAJWID-V3.8-2013" || source.pageCount !== 69) {
  throw new Error("Canonical progressive PDF identity is missing or unexpected.");
}
if (source.sha256 !== "cfcfc69f02970dcb0d6517af2cca3cf7b73abff52a039b940ffaa39082e8e4e1") {
  throw new Error("Canonical progressive PDF SHA-256 changed unexpectedly.");
}
if (JSON.stringify(source.baghdadiyyahPageRange) !== JSON.stringify([22, 62])) {
  throw new Error("Canonical Baghdadiyyah page range must remain 22-62.");
}
if (source.repositoryBacked !== false) {
  throw new Error("Source must remain non-repository-backed until evidence import is completed.");
}

const sequenced = (registry.modules ?? [])
  .filter((entry) => Number.isInteger(entry.sequence))
  .sort((a,b) => a.sequence - b.sequence);
if (JSON.stringify(sequenced.map((entry) => entry.id)) !== JSON.stringify(expectedSequenced)) {
  throw new Error("Progressive source module sequence does not match the approved human/source sequence.");
}
for (const entry of registry.modules ?? []) {
  if (!Array.isArray(entry.sourcePdfPages) || entry.sourcePdfPages.length === 0) {
    throw new Error(`Missing canonical PDF page mapping for ${entry.id}.`);
  }
  if (entry.sourcePdfPages.some((page) => !Number.isInteger(page) || page < 22 || page > 62)) {
    throw new Error(`Invalid canonical PDF page mapping for ${entry.id}.`);
  }
}

const byId = new Map((registry.modules ?? []).map((entry) => [entry.id, entry]));
for (const id of ["tanwin_fath", "tanwin_kasr", "tanwin_damm", "sukun"]) {
  if (byId.get(id)?.targetCategory !== "vowels_sukun") {
    throw new Error(`${id} must be assigned to vowels_sukun.`);
  }
}
if ((registry.modules ?? []).filter((entry) => entry.id === "two_words").length !== 1) {
  throw new Error("Progressive source registry must contain exactly one two_words module.");
}
if (byId.get("two_words")?.targetCategory !== "linking" || byId.get("two_words")?.activation !== "deferred_until_linking") {
  throw new Error("Two-word source material must remain deferred to linking.");
}
if (byId.has("tanwin_mixed")) {
  throw new Error("Canonical page map must not invent a tanwin_mixed module.");
}
if (byId.get("pre_sukun_open_letters_recap")?.sourcePdfPages?.[0] !== 46 || byId.get("pre_sukun_open_letters_recap")?.activation !== "never_directly_activated") {
  throw new Error("Canonical page 46 must remain a source-reference-only open-letter recap.");
}
if (byId.get("tanwin_fath")?.sourcePdfPages?.join(",") !== "39" || byId.get("tanwin_fath")?.activation !== "source_reference_only_no_word_candidates") {
  throw new Error("Tanwin Fath must remain a page-39 source-reference-only introduction.");
}
if (byId.get("tanwin_kasr")?.sourcePdfPages?.join(",") !== "40,41,42") {
  throw new Error("Tanwin Kasr must map to canonical pages 40-42.");
}
if (byId.get("tanwin_damm")?.sourcePdfPages?.join(",") !== "43,44,45") {
  throw new Error("Tanwin Damm must map to canonical pages 43-45.");
}
if (byId.get("sukun")?.sourcePdfPages?.join(",") !== "47,48,49") {
  throw new Error("Sukun must map to canonical pages 47-49.");
}
if (byId.get("long_reading")?.targetCategory !== "fluent_reading" || byId.get("long_reading")?.activation !== "deferred_until_fluent_reading") {
  throw new Error("Long-reading source material must remain deferred to fluent_reading.");
}
if (byId.get("shaddah_source_block")?.targetCategory !== "shaddah") {
  throw new Error("The canonical shaddah source block must be reserved for shaddah.");
}
if (plan.status !== registry.status) {
  throw new Error("Progressive curriculum and source-intake statuses must agree.");
}
if (plan.controlledTranscriptionGate?.status !== "candidate_transcription_requires_human_verification") {
  throw new Error("Controlled transcription gate must require human verification of candidates.");
}
if (plan.controlledTranscriptionGate?.humanTypingRequired !== false) {
  throw new Error("Controlled transcription gate must not require human retyping.");
}
console.log("OK: canonical progressive PDF is registered with a verification-first, fail-closed transcription workflow.");
