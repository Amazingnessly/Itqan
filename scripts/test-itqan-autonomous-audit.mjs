import assert from "node:assert/strict";
import { summarize, shouldPollForIntegrationCi, INTEGRATION_BRANCH } from "./itqan-autonomous-audit.mjs";

const mainSha = "a".repeat(40);
const integrationSha = "b".repeat(40);
const expected = { mainSha, integrationSha, runs: [], pullRequests: [] };

const noRuns = summarize(expected);
assert.equal(noRuns.integrationState, "not_verified");
assert.equal(noRuns.lastVerifiedIntegrationCheckpoint, null);
assert.equal(noRuns.codeDispatchEnabled, false);
assert.equal(noRuns.automaticMergeEnabled, false);

const wrongSha = summarize({
  ...expected,
  runs: [{ name: "Itqan CI", head_sha: mainSha, head_branch: INTEGRATION_BRANCH, event: "push", status: "completed", conclusion: "success" }]
});
assert.equal(wrongSha.integrationState, "not_verified", "CI for a different SHA must not be trusted");

const skipped = summarize({
  ...expected,
  runs: [{ name: "Itqan CI", head_sha: integrationSha, head_branch: INTEGRATION_BRANCH, event: "push", status: "completed", conclusion: "skipped" }]
});
assert.equal(skipped.integrationState, "not_verified", "skipped is never success");

const pending = summarize({
  ...expected,
  runs: [{ name: "Itqan CI", head_sha: integrationSha, head_branch: INTEGRATION_BRANCH, event: "push", status: "in_progress", conclusion: null }]
});
assert.equal(pending.integrationState, "ci_in_progress");

const green = summarize({
  ...expected,
  runs: [{ id: 123, html_url: "https://github.com/Amazingnessly/Itqan/actions/runs/123", name: "Itqan CI", head_sha: integrationSha, head_branch: INTEGRATION_BRANCH, event: "push", status: "completed", conclusion: "success" }],
  pullRequests: [{ number: 12, title: "Test", head: { sha: mainSha }, base: { sha: integrationSha }, draft: true }]
});
assert.equal(green.integrationState, "verified_by_ci");
assert.equal(green.lastVerifiedIntegrationCheckpoint.sha, integrationSha);
assert.equal(green.openIntegrationPullRequests.length, 1);
assert.equal(green.openIntegrationPullRequests[0].draft, true);
assert.equal(green.productionDeployEnabled, false);
const ciRun = (id, status, conclusion) => ({
  id,
  name: "Itqan CI",
  head_sha: integrationSha,
  head_branch: INTEGRATION_BRANCH, event: "push",
  status,
  conclusion,
  html_url: `https://github.com/Amazingnessly/Itqan/actions/runs/${id}`
});
const oldSuccessNewFailure = summarize({
  ...expected,
  runs: [ciRun(11, "completed", "success"), ciRun(12, "completed", "failure")]
});
assert.equal(oldSuccessNewFailure.integrationState, "not_verified");
assert.equal(oldSuccessNewFailure.lastVerifiedIntegrationCheckpoint, null);
assert.equal(oldSuccessNewFailure.mostRecentIntegrationCi.runId, 12);

const oldSuccessNewPending = summarize({
  ...expected,
  runs: [ciRun(22, "in_progress", null), ciRun(21, "completed", "success")]
});
assert.equal(oldSuccessNewPending.integrationState, "ci_in_progress");
assert.equal(oldSuccessNewPending.lastVerifiedIntegrationCheckpoint, null);

const newerGreenOldFailure = summarize({
  ...expected,
  runs: [ciRun(32, "completed", "success"), ciRun(31, "completed", "failure")]
});
assert.equal(newerGreenOldFailure.integrationState, "verified_by_ci");
assert.equal(newerGreenOldFailure.lastVerifiedIntegrationCheckpoint.runId, 32);

const oldSuccessNewCancelled = summarize({
  ...expected,
  runs: [ciRun(41, "completed", "success"), ciRun(42, "completed", "cancelled")]
});
assert.equal(oldSuccessNewCancelled.integrationState, "not_verified");
assert.equal(oldSuccessNewCancelled.lastVerifiedIntegrationCheckpoint, null);

// A pull_request result, even with an identical SHA and successful checks,
// must never be mistaken for the post-merge integration push checkpoint.
const prOnly = summarize({
  ...expected,
  runs: [{ ...ciRun(51, "completed", "success"), event: "pull_request" }]
});
assert.equal(prOnly.integrationState, "not_verified");
assert.equal(prOnly.lastVerifiedIntegrationCheckpoint, null);

// A newer PR success cannot conceal a failed integration push.
const failedPushNewerPr = summarize({
  ...expected,
  runs: [
    ciRun(52, "completed", "failure"),
    { ...ciRun(53, "completed", "success"), event: "pull_request" }
  ]
});
assert.equal(failedPushNewerPr.integrationState, "not_verified");
assert.equal(failedPushNewerPr.mostRecentIntegrationCi.runId, 52);

// Absent event metadata is unverified rather than implicitly authorized.
const missingEvent = summarize({
  ...expected,
  runs: [{ ...ciRun(54, "completed", "success"), event: undefined }]
});
assert.equal(missingEvent.integrationState, "not_verified");

// Before GitHub creates its push-triggered CI run, an exact-SHA audit must
// retry briefly instead of reporting a definitive absence immediately.
assert.equal(shouldPollForIntegrationCi(noRuns), true);
assert.equal(shouldPollForIntegrationCi(wrongSha), true);
assert.equal(shouldPollForIntegrationCi(prOnly), true);
assert.equal(shouldPollForIntegrationCi(missingEvent), true);
assert.equal(shouldPollForIntegrationCi(pending), true);
assert.equal(shouldPollForIntegrationCi(oldSuccessNewPending), true);

// A completed result is authoritative; polling again must not mask failures,
// cancelled/skipped runs or an already verified success.
assert.equal(shouldPollForIntegrationCi(green), false);
assert.equal(shouldPollForIntegrationCi(skipped), false);
assert.equal(shouldPollForIntegrationCi(oldSuccessNewFailure), false);
assert.equal(shouldPollForIntegrationCi(oldSuccessNewCancelled), false);
assert.equal(shouldPollForIntegrationCi(newerGreenOldFailure), false);

assert.throws(() => summarize({ ...expected, integrationSha: "bad" }));
console.log("Itqan autonomous audit safety tests passed.");
