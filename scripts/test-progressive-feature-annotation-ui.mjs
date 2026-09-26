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
assert.ok(page.includes('fetch("/content/source-intake/feature-annotation-policy.json")'), "annotation UI must load the shared controlled feature-annotation policy");
assert.ok(page.includes("await sha256Bytes(policyBuffer)"), "annotation UI must hash the exact shared policy bytes");
assert.ok(page.includes("validateFeatureAnnotationPolicy(JSON.parse(policyText)"), "annotation UI must validate the shared policy before review");
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
assert.ok(page.includes("materialShapeObserved: null"), "material shape must start unreviewed and match the backend template schema");
assert.ok(page.includes("hamzatWaslCandidate: null"), "Hamzat-Wasl candidacy must start unreviewed");
assert.ok(page.includes("featureInventoryComplete: null"), "feature inventory completion must start unreviewed");
assert.ok(page.includes("targetFeatureConfirmed: null"), "target feature must not be pre-confirmed");
assert.ok(page.includes("stagePurityConfirmed: null"), "stage purity must not be pre-confirmed");
assert.ok(page.includes("reviewedByQualifiedHuman: false"), "qualified-human review must not be pre-confirmed");
assert.ok(page.includes("ambiguous: null"), "metadata ambiguity must use the backend gate field and start unreviewed");

assert.ok(page.includes('"pending_qualified_human_feature_annotation"'), "UI must support resumable draft annotation exports");
assert.ok(page.includes('"qualified_human_feature_annotation_complete"'), "UI must support completed qualified-human annotation exports");
assert.ok(page.includes("promotedCandidate?.sha256 !== candidateState.sha256"), "resumed annotations must stay bound to the exact candidate file hash");
assert.ok(page.includes("artifact.featureAnnotationPolicy?.schemaVersion !== featurePolicy?.policy.schemaVersion"), "resumed annotations must bind the shared policy schema");
assert.ok(page.includes("artifact.featureAnnotationPolicy?.sha256 !== featurePolicy?.sha256"), "resumed annotations must bind the exact shared policy bytes");
assert.ok(page.includes("draft.arabicUtf8Sha256 !== item.integrity.utf8Sha256"), "resumed annotations must stay bound to exact Arabic UTF-8 hashes");
assert.ok(page.includes("firstIncomplete"), "resumed annotation must return to the first incomplete item");
assert.ok(page.includes("const allComplete"), "complete export must be gated on all item-level reviews");
assert.ok(page.includes('disabled={!allComplete}'), "qualified complete export must stay disabled until every item is ready");
assert.ok(page.includes("downloadArtifact(false)"), "reviewer must be able to explicitly export a non-authoritative draft");
assert.ok(page.includes("downloadArtifact(true)"), "reviewer must be able to explicitly export a completed annotation");

assert.ok(page.includes('meta.hamzatWaslCandidate !== null'), "completion must require an explicit Hamzat-Wasl boolean");
assert.ok(page.includes('meta.ambiguous === false'), "completion must require explicit non-ambiguity using the backend gate field");
assert.ok(page.includes("annotationFitsPolicy"), "UI must evaluate the shared module policy without inferring features");
assert.ok(page.includes("policy.requiredMarks.some((mark) => !focus.has(mark))"), "shared policy required marks must gate local completion");
assert.ok(page.includes("policy.forbiddenMarks.some((mark) => focus.has(mark))"), "shared policy forbidden marks must gate local completion");
assert.ok(page.includes('policy.articleClasses === "shamsiyyah_only"'), "shared policy article modes must gate local completion");
assert.ok(page.includes("featurePolicy?.policy.controlledFocusMarks"), "focus-mark options must render from the shared controlled policy");
assert.ok(page.includes("featurePolicy?.policy.controlledArticleClasses"), "article-class options must render from the shared controlled policy");
assert.ok(page.includes("featurePolicy?.policy.controlledMaterialShapes"), "material-shape options must render from the shared controlled policy");
assert.ok(page.includes("featureAnnotationPolicy: {"), "exported annotations must carry shared policy identity");
assert.ok(page.includes("sha256: featurePolicy.sha256"), "exported annotations must carry the exact shared policy SHA-256");

assert.ok(!page.includes("localStorage"), "feature annotation must not silently persist linguistic metadata");
assert.ok(!/method\s*:\s*["'](?:POST|PUT|PATCH|DELETE)/i.test(page), "feature annotation must not send authoring data to a server");
assert.ok(!arabicPattern.test(page), "feature annotation UI must not hard-code Arabic exercise content");

console.log("Progressive qualified-human feature annotation UI safety contract passed.");
