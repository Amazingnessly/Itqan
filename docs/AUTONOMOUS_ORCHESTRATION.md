# Itqān autonomous orchestration — fail-closed rollout

Updated: 2026-10-15. Scope: **Amazingnessly/Itqan only**. Never access or modify Ascend or Sirāfiq in this workflow.

## Purpose and locked boundaries

Itqān develops accurate Arabic reading before fluency using **VOIR → DÉCOMPOSER → PRONONCER → FLUIDIFIER**. All requirements in [../AGENTS.md](../AGENTS.md) remain authoritative, notably the six locked categories, seven learner stages, exact source-verified Arabic, qualified-human double visual review, and delayed mastery checks. This infrastructure must never author, correct, normalize, approve or activate new Arabic material.

## Current architecture (observed, not conjectured)

- Frontend: React, TypeScript, Vite, mobile-first.
- Backend/deployment: Cloudflare Worker; voice assessment is advisory.
- Tests: `.github/workflows/itqan-ci.yml` covers content integrity, learning engine, persistence, browser journey, worker and build checks.
- Existing read-only agent analysis: `tools/agents/orchestrator.mjs` runs four OpenAI Agents SDK specialists when the manual `agents-run.yml` workflow is dispatched. It **does not** edit files, create Codex tasks, or merge PRs. It may require an OpenAI API secret and incur usage charges; do not start it automatically.
- Existing wave: `scripts/itqan-wave-orchestrator.mjs` and `scripts/itqan-wave-planner.mjs` operate in `observe` mode, with `dispatchEnabled: false` and `autoMerge: false`.
- Production: `.github/workflows/cloudflare-deploy.yml` deploys automatically **after a push to main**. Never modify main or trigger manual production deployment without explicit user authorization.

## Branch and CI policy

- `main`: protected by **operational policy**, no direct pushes and no PR merges without explicit user authorization.
- `integration/itqan-autonomous`: isolated integration branch. Created at the then-current main HEAD. Integration only after a PR is green for its exact head SHA, targets the current integration base, and all required checks finish successfully. No skipped, pending, cancelled, or missing check counts as success.
- `agents/itqan-<mission>`: isolated agent work branches. Parallelism only for non-overlapping files/dependencies. Sequential integration.
- The integration branch has dedicated CI triggers; production deployment remains main-only. A CI run for one ref is not reusable for a different SHA.
- Current GitHub App connection does not expose repository administration/branch-protection writes; verify and enable repository rulesets or branch protection in GitHub settings separately. As of this audit, `main` reported **no active GitHub branch protection**.

## Audit workflow and checkpoint

`.github/workflows/itqan-autonomous-audit.yml` runs a bounded, read-only audit after integration pushes, on manual dispatch (where supported), and on a planned four-hour cron (`17 */4 * * *`). **GitHub schedule triggers execute only for workflows present on the default branch**, so the cron is NOT active while this file exists only on the work/integration branch. Moving it to main requires the user's separate authorization and would also trigger the existing production deployment workflow; do not do this implicitly.

The audit fetches only this repository's `main` and integration refs, integration workflow runs and integration PRs. It writes an artifact with:

- full main/integration commit SHAs;
- successful `Itqan CI` run for the **exact current integration SHA**, if any;
- status `verified_by_ci`, `ci_in_progress`, or `not_verified`;
- open PR head/base SHAs and draft status;
- explicit disabled flags for automatic dispatch, merge, and deploy;
- human-only/pending capability blockers.

It uses a read-only `GITHUB_TOKEN`, four API reads, a five-minute job timeout, one serialized concurrency group, no external LLM calls, and 30-day artifact retention. Every failed read stops the audit. A retained workflow artifact is a **time-limited execution record**, not a substitute for versioned memory or for a durable checkpoint after 30 days.

The versioned handoff is [AUTONOMOUS_CHECKPOINT.md](AUTONOMOUS_CHECKPOINT.md). Update it only after confirming CI for the exact recorded SHA. CI checks on PRs and integration pushes are authoritative; an older green state must never bless new code.

## Development cycle and failure caps

1. Read `AGENTS.md`, checkpoint, open PRs/issues and main/integration SHAs.
2. Confirm exact last green integration SHA. If no green checkpoint exists, inspect and fix CI before proposing merges.
3. Choose an independently scoped task prioritized security → regressions → core reliability → core completion → UX/accessibility → performance.
4. Define acceptance criteria. Implement in one isolated branch. Do not write Arabic exercise material or weaken guards.
5. Run relevant local/static checks when a safe checkout is available. Create PR into integration, and wait for complete GitHub CI on that PR's exact head SHA.
6. Review diff/security/invariants, recheck target head freshness immediately before merging. No merge if CI absent, skipped, failed, stale or incomplete.
7. After any authorized integration merge, require a fresh green integration push CI before recording a new checkpoint.
8. On a failure, distinguish infrastructure outage from regression; at most two automated retries for a transient fault per mission, then stop and record blocker rather than looping.
9. Continue only to tasks with clear acceptance criteria. Never invent work merely to keep agents busy.

No code-writing Codex dispatch connector was established in this audit. The existing OpenAI Agents SDK workflow is **manual analysis only**; do not claim autonomous code-writing. Enabling write-capable Codex tasks requires a separately reviewed authenticated runner, least-privilege credentials, isolated branches, dry-run tests, and per-run budget limits. Automatic merging remains disabled until separately proven safe and authorized.

## Gates and human decisions

- Qualified-human validation remains mandatory for Arabic visual verification, linguistic feature annotations, manifest reviews, and release gates (including issue #152). No AI agent or passing CI substitutes for qualified-human evidence.
- The V1 release is not declared ready while its human-content and full learner-journey gates remain incomplete.
- Never spend funds, alter production, migrate/delete real data, change product scope, edit another repository or change `main` without the required authorization.
- Production is already coupled to `main`. This is a concrete reason to keep orchestration development isolated, not a reason to bypass its deployment gate.
- Before enabling paid agents, separately configure credential scoping, max calls/tokens/concurrency and an external hard cost cap; this read-only job consumes GitHub Actions minutes only, subject to the account's existing allowance.
- If CI or GitHub APIs are unavailable, record `blocked`; do not assume application regression.

## Readiness to enable more autonomy

Prerequisites, not claims of completion: (1) permanent GitHub branch protection/rulesets, (2) integration-branch test green, (3) monitored checkpoint artifact run, (4) reviewed Codex dispatcher with strict credentials and quotas, (5) GitHub default-branch scheduled workflow activation only with separate explicit user permission to merge into main and deploy. Until then, autonomous operation is **observation only**.
