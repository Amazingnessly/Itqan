import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("src/pages/ControlledManifestReview/ControlledManifestReviewPage.tsx", "utf8");
const routes = fs.readFileSync("src/app/routes.tsx", "utf8");
const app = fs.readFileSync("src/app/App.tsx", "utf8");
const sources = fs.readFileSync("src/pages/Sources/SourcesPage.tsx", "utf8");
const arabicPattern = /[\u0600-\u06ff]/u;

assert.ok(routes.includes('"controlled-manifest-review"'), "controlled-manifest-review route must exist");
assert.ok(app.includes("<ControlledManifestReviewPage"), "controlled manifest review page must be routed");
assert.ok(app.includes('route !== "controlled-manifest-review"'), "bottom navigation must stay hidden during controlled-manifest review");
assert.ok(sources.includes("onOpenControlledManifestReview"), "Sources page must expose the controlled-manifest review surface");

assert.ok(page.includes('files.length !== 3'), "review UI must require exactly three upstream artifacts");
assert.ok(page.includes('"human_verified_repository_evidence_bound_pending_item_metadata"'), "review UI must identify the exact promoted candidate state");
assert.ok(page.includes('"qualified_human_feature_annotation_complete"'), "review UI must require completed qualified-human feature annotation");
assert.ok(page.includes('"human_verified_repository_evidence_bound_item_metadata_annotated_pending_controlled_manifest_review"'), "review UI must identify the exact annotated candidate state");
assert.ok(page.includes("annotation.promotedCandidate?.sha256 !== promotedEntry.sha256"), "review UI must bind feature annotation to exact promoted bytes");
assert.ok(page.includes("annotated.annotationControl?.promotedCandidateSha256 !== promotedEntry.sha256"), "review UI must bind annotated candidate to exact promoted bytes");
assert.ok(page.includes("annotation.featureAnnotationPolicy?.sha256 !== policySha256"), "review UI must bind annotation to current feature policy bytes");
assert.ok(page.includes("annotated.annotationControl?.featureAnnotationPolicySha256 !== policySha256"), "review UI must bind annotated candidate to current feature policy bytes");

assert.ok(page.includes("item.arabicExact !== original.arabicExact"), "review UI must reject exact Arabic byte drift between promoted and annotated artifacts");
assert.ok(page.includes("await sha256TextExact(item.arabicExact) !== item.integrity?.utf8Sha256"), "review UI must re-hash exact Arabic bytes");
assert.ok(page.includes("registeredPositions.has(position)"), "review UI must keep every item bound to a registered source position");
assert.ok(page.includes('item.metadataStatus !== "human_annotated_pending_controlled_manifest_review"'), "review UI must require the exact annotated metadata state");
assert.ok(page.includes("annotationMatchesPolicy(item, modulePolicy)"), "review UI must re-check annotated metadata against the shared module policy");
assert.ok(page.includes("sameJson(feature.annotation.focusMarksObserved, item.focusMarksObserved)"), "review UI must compare annotated marks to the qualified-human annotation");
assert.ok(page.includes("feature.annotation.hamzatWaslCandidate !== item.hamzatWaslCandidate"), "review UI must compare Hamzat-Wasl metadata to the annotation artifact");

assert.ok(page.includes('normalized.startsWith("public/content/evidence/")'), "review evidence must remain under repository evidence root");
assert.ok(page.includes('normalized.split("/").includes("..")'), "review UI must reject evidence path traversal");
assert.ok(page.includes("await fetch(url)"), "review UI must fetch deployed evidence bytes");
assert.ok(page.includes("await sha256Bytes(await response.arrayBuffer())"), "review UI must re-hash deployed evidence bytes");
assert.ok(page.includes("fullHash !== item.verification.evidenceIntegrity.fullSha256"), "review UI must reject full-page evidence hash drift");
assert.ok(page.includes("cropHash !== item.verification.evidenceIntegrity.cropSha256"), "review UI must reject crop evidence hash drift");

assert.ok(page.includes("controlledMetadataSha256"), "review UI must bind every review item to a controlled metadata hash");
assert.ok(page.includes("exactBytesAndHashReviewed: false"), "review checks must start false");
assert.ok(page.includes("evidenceBindingReviewed: false"), "evidence review must start false");
assert.ok(page.includes("featureMetadataReviewed: false"), "feature metadata review must start false");
assert.ok(page.includes("exerciseAuthorizationReviewed: false"), "exercise authorization review must start false");
assert.ok(page.includes("stagePurityReviewed: false"), "stage-purity review must start false");
assert.ok(page.includes("decision: null"), "review decision must start unset");
assert.ok(page.includes("reviewedByQualifiedContentReviewer: false"), "qualified reviewer confirmation must start false");

assert.ok(page.includes('review.decision === "approve"'), "complete review must require explicit approval");
assert.ok(page.includes('currentDraft.review.decision === "reject"'), "review UI must preserve explicit rejection as a blocking state");
assert.ok(page.includes('disabled={!allComplete}'), "complete review export must stay disabled until every item is approved");
assert.ok(page.includes('"pending_qualified_content_review"'), "review UI must support explicit resumable draft export");
assert.ok(page.includes('"qualified_content_review_complete"'), "review UI must export the backend complete-review status");
assert.ok(page.includes('authority: "qualified_content_reviewer"'), "review artifact must use backend reviewer authority");
assert.ok(page.includes("contentRewriteAllowed: false"), "review artifact must forbid content rewriting");
assert.ok(page.includes("activationAllowed: false"), "review artifact must forbid activation");
assert.ok(page.includes("itemExclusionAllowed: false"), "review artifact must forbid silent item exclusion");
assert.ok(page.includes("everyItemDecisionRequired: true"), "review artifact must require every item decision");

assert.ok(page.includes("review.inputs?.promotedCandidateSha256 !== packet.promotedSha256"), "resumed review must bind exact promoted bytes");
assert.ok(page.includes("review.inputs?.featureAnnotationSha256 !== packet.annotationSha256"), "resumed review must bind exact annotation bytes");
assert.ok(page.includes("review.inputs?.annotatedCandidateSha256 !== packet.annotatedSha256"), "resumed review must bind exact annotated bytes");
assert.ok(page.includes("review.inputs?.featureAnnotationPolicySha256 !== packet.featurePolicySha256"), "resumed review must bind exact feature policy bytes");
assert.ok(page.includes("item.controlledMetadataSha256 !== expected.controlledMetadataSha256"), "resumed review must reject metadata hash drift");

assert.ok(!page.includes("localStorage"), "controlled-manifest review must not silently persist reviewer decisions");
assert.ok(!/method\s*:\s*["'](?:POST|PUT|PATCH|DELETE)/i.test(page), "controlled-manifest review must not send authoring data to a server");
assert.ok(!arabicPattern.test(page), "controlled-manifest review UI must not hard-code Arabic exercise content");

console.log("Progressive controlled-manifest review UI safety contract passed.");
