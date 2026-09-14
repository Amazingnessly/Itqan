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

This first version is advisory: it produces a coordinated implementation brief. It does **not** edit files, commit code, merge pull requests, or bypass the repository validation workflow.

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

A manual workflow is available at `.github/workflows/agents-run.yml` once that workflow is merged to the default branch.

Configure a repository Actions secret named `OPENAI_API_KEY`, then open **Actions → Run Itqan agents → Run workflow** and provide the task text. The key stays in GitHub Actions secrets and is exposed only to the agent-run job as an environment variable.

The workflow deliberately uses `permissions: contents: read`; the first live runs remain advisory and cannot modify the repository through the GitHub token.

## Status

- orchestration code: implemented;
- JavaScript syntax check: verified;
- dependency installation: to verify in an environment with npm registry access;
- live OpenAI agent run: to verify with `OPENAI_API_KEY` configured;
- repository modification by agents: not enabled in this first version.

## Next safe extension

Once this advisory workflow is validated, a later PR can give selected agents isolated sandbox/worktree access for implementation and testing. Keep each implementation agent on its own branch/worktree and require the existing validators before any merge proposal.
