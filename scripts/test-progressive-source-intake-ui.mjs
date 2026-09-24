import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("src/pages/SourceIntake/SourceIntakePage.tsx", "utf8");
const app = fs.readFileSync("src/app/App.tsx", "utf8");
const routes = fs.readFileSync("src/app/routes.tsx", "utf8");
const sources = fs.readFileSync("src/pages/Sources/SourcesPage.tsx", "utf8");
const arabicPattern = /[\u0600-\u06ff]/u;

assert.ok(routes.includes('"source-intake"'), "source-intake route must exist");
assert.ok(app.includes("<SourceIntakePage"), "source intake page must be routed");
assert.ok(app.includes('route !== "source-intake"'), "bottom navigation must be hidden during local intake");
assert.ok(sources.includes("onOpenSourceIntake"), "Sources page must expose intake entry");
assert.ok(page.includes('fetch("/content/source-intake/progressive-support.json")'), "intake must use the controlled source registry");
assert.ok(page.includes("crypto.subtle.digest"), "workflow must hash exact bytes");
assert.ok(page.includes("new TextEncoder().encode(value)"), "approved Arabic hash must derive from exact UTF-8 input");
assert.ok(page.includes("readJsonFile<CandidateBundle>"), "workflow must import provisional candidate bundles");
assert.ok(page.includes("selectedModule?.candidateBundle"), "workflow must support registered automatic candidate loading");
assert.ok(page.includes("fetch(selectedModule.candidateBundle)"), "registered candidates must be fetched automatically for verification");
assert.ok(page.includes('"itqan-progressive-provisional-transcription"'), "candidate bundle kind must be explicit");
assert.ok(page.includes("bundle.authoritative !== false"), "provisional candidates must be non-authoritative");
assert.ok(page.includes("sourcePdf.sha256 === registry.sourceDocument.sha256"), "canonical PDF must be verified by SHA-256");
assert.ok(page.includes("candidateOrigin: \"provisional_machine\""), "imported candidates must retain provisional origin");
assert.ok(page.includes("arabicExact: item.arabicCandidate"), "candidate text must be prefilled for human verification");
assert.ok(page.includes("normalizationApplied: false"), "export must declare no normalization");
assert.ok(page.includes('entry.arabicExact.normalize("NFC") !== entry.arabicExact'), "NFC difference may be observed but not applied");
assert.ok(page.includes("humanVerificationAuthority: true"), "human verification must be the authority");
assert.ok(page.includes("candidateTranscriptionAuthoritative: false"), "candidate transcription must remain non-authoritative");
assert.ok(page.includes("visualPass1: entry.visualPass1"), "visual pass 1 must be exported");
assert.ok(page.includes("visualPass2: entry.visualPass2"), "visual pass 2 must be exported");
assert.ok(page.includes("entry.ambiguity === \"no\""), "export must require explicit non-ambiguity");
assert.ok(page.includes('anchor.download = "itqan-progressive-human-verification.json"'), "verification must export a portable JSON bundle");
assert.ok(page.includes("<object className=\"intake-pdf-preview\""), "canonical PDF must be viewable beside candidates");
assert.ok(!page.includes("localStorage"), "source intake must not silently persist draft Arabic");
assert.ok(!/method\s*:\s*["'](?:POST|PUT|PATCH|DELETE)/i.test(page), "verification workflow must not send authoring data to a server");
assert.ok(!arabicPattern.test(page), "verification UI must not hard-code Arabic exercise content");

console.log("Progressive verification-first source-intake UI safety contract passed.");
