import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("src/pages/FeatureAnnotation/FeatureAnnotationPage.tsx", "utf8");
const routes = fs.readFileSync("src/app/routes.tsx", "utf8");
const app = fs.readFileSync("src/app/App.tsx", "utf8");
const sources = fs.readFileSync("src/pages/Sources/SourcesPage.tsx", "utf8");
const arabicPattern = /[\u0600-\u06ff]/u;

assert.ok(routes.includes('"feature-annotation"'), "feature-annotation route must exist");
assert.ok(app.includes("<FeatureAnnotationPage"), "feature annotation page must be routed");
assert.ok(app.includes('route !== "feature-annotation"'), "bottom navigation must stay hidden during qualified feature annotation");
assert.ok(sources.includes("onOpenFeatureAnnotation"), "Sources page must expose the feature annotation surface");

assert.ok(page.includes('fetch("/content/source-intake/progressive-support.json")'), "annotation UI must load the controlled progressive registry");
assert.ok(page.includes('"human_verified_repository_evidence_bound_pending_item_metadata"'), "annotation UI must accept only the promoted pre-metadata state");
assert.ok(page.includes('candidate.sourceControl?.canonicalSha256 !== currentRegistry.sourceDocument.sha256'), "annotation UI must bind promoted candidates to the canonical source SHA-256");
assert.ok(page.includes('item.metadataStatus !== "pending_item_level_feature_annotation"'), "annotation UI must reject candidates outside the pending item-metadata state");
assert.ok(page.includes('item.eligibleForActiveLesson !== false'), "annotation UI must reject candidates already eligible for active lessons");
assert.ok(page.includes('item.active !== false'), "annotation UI must reject active candidates");
assert.ok(page.includes('await sha256TextExact(item.arabicExact) !== item.integrity?.utf8Sha256'), "annotation UI must re-hash exact Arabic bytes without normalization");
assert.ok(page.includes("registeredPositions.has(key)"), "annotation UI must bind each promoted item to a registered candidate source position");

assert.ok(page.includes('normalized.startsWith("public/content/evidence/")'), "annotation evidence paths must remain under the repository evidence root");
assert.ok(page.includes('normalized.split("/").includes("..")'), "annotation UI must reject evidence path traversal");
assert.ok(page.includes("await fetch(url)"), "annotation UI must fetch deployed repository evidence");
assert.ok(page.includes("await sha256Bytes(await response.arrayBuffer())"), "annotation UI must re-hash deployed repository evidence bytes");
assert.ok(page.includes("fullHash !== item.verification.evidenceIntegrity?.fullSha256"), "annotation UI must reject full-page evidence hash drift");
assert.ok(page.includes("cropHash !== item.verification.evidenceIntegrity?.cropSha256"), "annotation UI must reject crop evidence hash drift");

assert.ok(page.includes("focusMarksObserved: []"), "linguistic focus marks must start blank");
assert.ok(page.includes("articleClassObserved: []"), "article classes must start blank");
assert.ok(page.includes('materialShapeObserved: ""'), "material shape must start blank");
assert.ok(page.includes("hamzatWaslCandidate: null"), "Hamzat-Wasl candidacy must start unreviewed");
assert.ok(page.includes("targetFeatureConfirmed: false"), "target feature must not be pre-confirmed");
assert.ok(page.includes("stagePurityConfirmed: false"), "stage purity must not be pre-confirmed");
assert.ok(page.includes("reviewedByQualifiedHuman: false"), "qualified-human review must not be pre-confirmed");
assert.ok(page.includes("ambiguity: null"), "metadata ambiguity must start unreviewed");

assert.ok(page.includes('"pending_qualified_human_feature_annotation"'), "UI must support resumable draft annotation exports");
assert.ok(page.includes('"qualified_human_feature_annotation_complete"'), "UI must support completed qualified-human annotation exports");
assert.ok(page.includes("promotedCandidate?.sha256 !== candidateState.sha256"), "resumed annotations must stay bound to the exact candidate file hash");
assert.ok(page.includes("draft.arabicUtf8Sha256 !== item.integrity.utf8Sha256"), "resumed annotations must stay bound to exact Arabic UTF-8 hashes");
assert.ok(page.includes("firstIncomplete"), "resumed annotation must return to the first incomplete item");
assert.ok(page.includes("const allComplete"), "complete export must be gated on all item-level reviews");
assert.ok(page.includes('disabled={!allComplete}'), "qualified complete export must stay disabled until every item is ready");
assert.ok(page.includes("downloadArtifact(false)"), "reviewer must be able to explicitly export a non-authoritative draft");
assert.ok(page.includes("downloadArtifact(true)"), "reviewer must be able to explicitly export a completed annotation");

assert.ok(page.includes('meta.hamzatWaslCandidate !== null'), "completion must require an explicit Hamzat-Wasl boolean");
assert.ok(page.includes('meta.ambiguity === false'), "completion must require explicit non-ambiguity");
assert.ok(page.includes("annotationFitsModule"), "UI must surface known module stage-purity constraints without inferring features");
assert.ok(page.includes('focus.has("sukun")'), "Sukun stage policy must require a human-observed Sukun mark");
assert.ok(page.includes('!focus.has("shaddah")'), "earlier-stage policies must reject human-recorded Shaddah leakage");
assert.ok(page.includes('article[0] === "shamsiyyah"'), "shamsiyyah module policy must remain shamsiyyah-only");

assert.ok(!page.includes("localStorage"), "feature annotation must not silently persist linguistic metadata");
assert.ok(!/method\s*:\s*["'](?:POST|PUT|PATCH|DELETE)/i.test(page), "feature annotation must not send authoring data to a server");
assert.ok(!arabicPattern.test(page), "feature annotation UI must not hard-code Arabic exercise content");

console.log("Progressive qualified-human feature annotation UI safety contract passed.");
