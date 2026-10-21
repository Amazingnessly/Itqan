import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const INTEGRATION_BRANCH = "integration/itqan-autonomous";
export const EXPECTED_REPOSITORY = "Amazingnessly/Itqan";

export function summarize({ mainSha, integrationSha, runs, pullRequests }) {
  if (!/^[a-f0-9]{40}$/.test(mainSha) || !/^[a-f0-9]{40}$/.test(integrationSha)) {
    throw new Error("Expected full 40-character Git commit SHAs.");
  }
  // Only a push to the integration branch validates the deployed branch HEAD.
  // A pull_request run may test a synthetic merge commit or different ref.
  const exactRuns = runs.filter(
    (run) => run.name === "Itqan CI" && run.event === "push" && run.head_sha === integrationSha && run.head_branch === INTEGRATION_BRANCH
  );
  // Runs returned by GitHub are normally newest-first, but sorting by the
  // monotonically increasing run ID avoids trusting collection order. An older
  // successful run must never overrule a newer failed, cancelled or pending run.
  const latest = exactRuns.sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0))[0];
  const green = latest?.status === "completed" && latest.conclusion === "success";
  const inProgress = latest !== undefined && latest.status !== "completed";
  return {
    schemaVersion: 1,
    repository: EXPECTED_REPOSITORY,
    mode: "observe_only",
    main: { branch: "main", sha: mainSha },
    integration: { branch: INTEGRATION_BRANCH, sha: integrationSha },
    mostRecentIntegrationCi: latest
      ? { runId: latest.id ?? null, status: latest.status, conclusion: latest.conclusion ?? null }
      : null,
    lastVerifiedIntegrationCheckpoint: green
      ? { sha: integrationSha, runId: latest.id, runUrl: latest.html_url, conclusion: "success" }
      : null,
    integrationState: green ? "verified_by_ci" : inProgress ? "ci_in_progress" : "not_verified",
    openIntegrationPullRequests: pullRequests.map((pr) => ({
      number: pr.number, title: pr.title, headSha: pr.head?.sha ?? null,
      baseSha: pr.base?.sha ?? null, draft: Boolean(pr.draft)
    })),
    codeDispatchEnabled: false,
    automaticMergeEnabled: false,
    productionDeployEnabled: false,
    decision: "observe_only",
    blockers: [
      "Codex write/dispatch capability not verified",
      "Qualified human Arabic approval remains mandatory",
      ...(green ? [] : ["No completed successful Itqan CI for exact integration HEAD"])
    ]
  };
}

// GitHub may publish an integration push before its CI run appears in the API.
// Only wait when the exact push CI is absent or still running. Terminal failures
// never retry implicitly or borrow success from an older/different run.
export function shouldPollForIntegrationCi(state) {
  return state.integrationState === "ci_in_progress" ||
    (state.integrationState === "not_verified" && state.mostRecentIntegrationCi === null);
}

async function api(path, token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch("https://api.github.com/repos/" + EXPECTED_REPOSITORY + path, {
      signal: controller.signal,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer " + token,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "itqan-read-only-audit"
      }
    });
    if (!response.ok) throw new Error("GitHub API returned HTTP " + response.status + " for " + path);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function main() {
  if (process.env.GITHUB_REPOSITORY !== EXPECTED_REPOSITORY) {
    throw new Error("Repository guard failed: not the Itqan repository.");
  }
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN required (read-only workflow token).");

  const [mainRef, integrationRef, runsData, prs] = await Promise.all([
    api("/git/ref/heads/main", token),
    api("/git/ref/heads/" + encodeURIComponent(INTEGRATION_BRANCH), token),
    api("/actions/runs?branch=" + encodeURIComponent(INTEGRATION_BRANCH) + "&per_page=30", token),
    api("/pulls?state=open&base=" + encodeURIComponent(INTEGRATION_BRANCH) + "&per_page=30", token)
  ]);
  // Push CI may not exist yet (or may still be executing) when this independent workflow starts.
  // Wait a strictly bounded period for the exact current SHA; never re-use an old green run.
  const summaryArgs = {
    mainSha: mainRef.object?.sha,
    integrationSha: integrationRef.object?.sha,
    pullRequests: prs
  };
  let state = summarize({ ...summaryArgs, runs: runsData.workflow_runs ?? [] });
  let pollAttempts = 0;
  while (shouldPollForIntegrationCi(state) && pollAttempts < 8) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 15000));
    pollAttempts += 1;
    const refreshed = await api(
      "/actions/runs?branch=" + encodeURIComponent(INTEGRATION_BRANCH) + "&per_page=30",
      token
    );
    state = summarize({ ...summaryArgs, runs: refreshed.workflow_runs ?? [] });
  }
  // A branch advancing during polling invalidates the checkpoint claim.
  const currentIntegrationRef = await api(
    "/git/ref/heads/" + encodeURIComponent(INTEGRATION_BRANCH),
    token
  );
  if (currentIntegrationRef.object?.sha !== summaryArgs.integrationSha) {
    throw new Error("Integration branch advanced during audit; checkpoint is stale.");
  }
  state.pollAttempts = pollAttempts;
  state.auditedAt = new Date().toISOString();
  await mkdir("artifacts", { recursive: true });
  await writeFile("artifacts/itqan-autonomous-audit.json", JSON.stringify(state, null, 2) + "\n");
  console.log(JSON.stringify(state, null, 2));
  if (state.integrationState === "not_verified") {
    console.log("No green integration checkpoint: no actions will be taken.");
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(async (error) => {
    const failure = {
      schemaVersion: 1, repository: EXPECTED_REPOSITORY, mode: "observe_only",
      auditedAt: new Date().toISOString(), decision: "blocked",
      reason: error.message, codeDispatchEnabled: false, automaticMergeEnabled: false
    };
    await mkdir("artifacts", { recursive: true });
    await writeFile("artifacts/itqan-autonomous-audit.json", JSON.stringify(failure, null, 2) + "\n");
    console.error(error.message);
    process.exitCode = 1;
  });
}
