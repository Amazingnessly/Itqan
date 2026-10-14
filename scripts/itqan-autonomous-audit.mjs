import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const INTEGRATION_BRANCH = "integration/itqan-autonomous";
export const EXPECTED_REPOSITORY = "Amazingnessly/Itqan";

export function summarize({ mainSha, integrationSha, runs, pullRequests }) {
  if (!/^[a-f0-9]{40}$/.test(mainSha) || !/^[a-f0-9]{40}$/.test(integrationSha)) {
    throw new Error("Expected full 40-character Git commit SHAs.");
  }
  const exactRuns = runs.filter(
    (run) => run.name === "Itqan CI" && run.head_sha === integrationSha && run.head_branch === INTEGRATION_BRANCH
  );
  const green = exactRuns.find((run) => run.status === "completed" && run.conclusion === "success");
  const inProgress = exactRuns.some((run) => run.status !== "completed");
  return {
    schemaVersion: 1,
    repository: EXPECTED_REPOSITORY,
    mode: "observe_only",
    main: { branch: "main", sha: mainSha },
    integration: { branch: INTEGRATION_BRANCH, sha: integrationSha },
    lastVerifiedIntegrationCheckpoint: green
      ? { sha: integrationSha, runId: green.id, runUrl: green.html_url, conclusion: "success" }
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
  const state = summarize({
    mainSha: mainRef.object?.sha,
    integrationSha: integrationRef.object?.sha,
    runs: runsData.workflow_runs ?? [],
    pullRequests: prs
  });
  state.auditedAt = new Date().toISOString();
  await mkdir("artifacts", { recursive: true });
  await writeFile("artifacts/itqan-autonomous-audit.json", JSON.stringify(state, null, 2) + "\n");
  console.log(JSON.stringify(state, null, 2));
  if (state.integrationState === "not_verified") {
    console.log("No green integration checkpoint: no actions will be taken.");
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
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
