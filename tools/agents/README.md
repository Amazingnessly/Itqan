# Itqān multi-agent orchestration

This tooling is intentionally isolated from the learner-facing application. It exists to accelerate product-development analysis while keeping `AGENTS.md` authoritative.

## Roles

Each run starts four specialists in parallel:

- Itqan Pedagogy
- Itqan UX
- Itqan Engineering
- Itqan QA

Their outputs are then passed to an Itqan Coordinator, which produces one reconciled execution brief.

## Safety model

Every agent receives the repository `AGENTS.md` as authoritative instructions. In particular, agents must not invent Arabic exercise strings, weaken content-integrity guards, treat speed as more important than precision, or claim tests were run without evidence.

Advisory runs also receive a bounded, read-only snapshot of text source/configuration files from the checked-out repository. Generated/dependency directories are excluded, oversized files are skipped, and the aggregate snapshot is capped. Agents are instructed to cite repository paths and to report missing/truncated evidence rather than guess.

This version remains advisory: it produces a coordinated implementation brief. It does **not** edit files, commit code, merge pull requests, or bypass the repository validation workflow.

## Local setup

From the repository root:

```bash
cd tools/agents
npm install
```

Set an OpenAI API key in the environment. Do not commit the key:

```bash
export OPENAI_API_KEY="..."
```

## Local run

Pass one concrete Itqān development task:

```bash
npm run run -- "Review the next learner-session improvement and produce an implementation brief"
```

The four specialist calls run concurrently with `Promise.all`, then the coordinator synthesizes their findings.

## GitHub Actions runner

A manual workflow is available at `.github/workflows/agents-run.yml`.

Configure a repository Actions secret named `OPENAI_API_KEY`, then open **Actions → Run Itqan agents → Run workflow** and provide the task text. The key stays in GitHub Actions secrets and is exposed only to the agent-run job as an environment variable.

The workflow deliberately uses `permissions: contents: read`; advisory agents cannot modify the repository through the GitHub token.

## Status

- orchestration code: implemented;
- JavaScript syntax check: verified;
- dependency installation in GitHub Actions: verified;
- live OpenAI agent run: verified;
- read-only repository snapshot for evidence-backed audits: implemented, to verify in a live run;
- repository modification by agents: not enabled.

## Next safe extension

Once repository-backed advisory audits are validated, a later PR can give selected implementation agents isolated sandbox/worktree access for implementation and testing. Keep each implementation agent on its own branch/worktree and require the existing validators before any merge proposal.
