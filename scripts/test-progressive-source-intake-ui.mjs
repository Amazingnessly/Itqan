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
assert.ok(page.includes("crypto.subtle.digest"), "bundle must hash exact bytes");
assert.ok(page.includes("new TextEncoder().encode(value)"), "Arabic hash must derive from exact UTF-8 input");
assert.ok(page.includes("FileReader"), "source evidence must be embedded from human-selected files");
assert.ok(page.includes("arabicExact: entry.arabicExact"), "exact human entry must be preserved");
assert.ok(page.includes("normalizationApplied: false"), "bundle must declare no normalization");
assert.ok(page.includes('entry.arabicExact.normalize("NFC") !== entry.arabicExact'), "NFC difference may be observed but not applied");
assert.ok(page.includes("humanControlledEntry: true"), "bundle must identify human-controlled entry");
assert.ok(page.includes("agentTranscription: false"), "bundle must deny agent transcription");
assert.ok(page.includes("visualPass1: entry.visualPass1"), "visual pass 1 must be exported");
assert.ok(page.includes("visualPass2: entry.visualPass2"), "visual pass 2 must be exported");
assert.ok(page.includes('entry.ambiguity === "yes"'), "ambiguity must be explicit");
assert.ok(page.includes('anchor.download = "itqan-progressive-human-intake.json"'), "intake must export a portable JSON bundle");
assert.ok(!page.includes("localStorage"), "source intake must not silently persist sensitive draft content");
assert.ok(!/method\s*:\s*["'](?:POST|PUT|PATCH|DELETE)/i.test(page), "source intake must not send authoring data to a server");
assert.ok(!arabicPattern.test(page), "source intake UI must not hard-code Arabic exercise content");

console.log("Progressive human source-intake UI safety contract passed.");
