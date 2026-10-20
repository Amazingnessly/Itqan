# Itqān — persistent orchestration checkpoint

Last audit date: 2026-10-20 (Europe/Paris). This record is a handoff, not a declaration that any untested change works.

## Identity and scope

Repository: `Amazingnessly/Itqan` (public).
Production branch: `main`; isolated integration: `integration/itqan-autonomous`.
Isolation: NEVER touch `Amazingnessly/Ascend`, `Amazingnessly/Sirafiq` or any other repository.
Authority: `AGENTS.md`, `docs/AUTONOMOUS_ORCHESTRATION.md`, source-intake policies and existing content-safety gates.

## Latest observed main checkpoint

- Main HEAD observed: `38375253f63590b48866bf5c762c7fe44795db01` (PR #251, 2026-09-28).
- [Itqan CI successful for that main SHA](https://github.com/Amazingnessly/Itqan/actions/runs/36430807094).
- [Cloudflare deployment workflow successful for that main SHA](https://github.com/Amazingnessly/Itqan/actions/runs/36430807177). This is a CI/workflow finding, not a fresh independent production browser verification.
- [Wave orchestrator](https://github.com/Amazingnessly/Itqan/actions/runs/36431029366) completed as `skipped`; do NOT call it a successful Codex dispatch or proof of autonomous execution.
- As of the initial audit there were zero open PRs. Main had no active branch protection.

## Integration status

Integration branch created at `38375253f63590b48866bf5c762c7fe44795db01`.
CI-trigger bootstrap committed to integration as `678eb829bfbb8a3eb7098527b2039dedf92e8ea6`.
**Last independently observed green integration checkpoint:** `20809c26361ef5eddc65244d6dbcb0bda5d64159` (merged PR #252; [post-merge Itqan CI success](https://github.com/Amazingnessly/Itqan/actions/runs/38652248852), checked 2026-10-15). This is a historical verified checkpoint, not evidence for any later SHA. The separate [post-merge read-only audit](https://github.com/Amazingnessly/Itqan/actions/runs/38652248993) succeeded but correctly recorded `ci_in_progress` because it ran before the CI had finished; the next hardening mission adds bounded waiting.

## Later verified integration checkpoint (2026-10-20 audit)

- Integration HEAD observed: `5804875f548b3a062086d2723733f16b6ca587a6` (PR #256).
- [Full post-merge Itqan CI succeeded on that exact SHA](https://github.com/Amazingnessly/Itqan/actions/runs/38804302625).
- [Read-only audit succeeded on that SHA](https://github.com/Amazingnessly/Itqan/actions/runs/38804302722).
- Main still observed at `38375253f63590b48866bf5c762c7fe44795db01`.
- No open PRs at audit time. The existing versioned checkpoint below was outdated; preserve its older entries as history, never as the latest green claim for a newer SHA.
- New isolated hardening mission: require `event=push` for the exact-SHA integration CI record, so a PR check cannot substitute for a post-merge integration CI. **This mission is not verified or integrated until its own PR and post-merge CI complete successfully.**

## Existing functionality and technical conventions

- React/TypeScript/Vite; Cloudflare Worker; guided mobile-first learner UI.
- Six authorized categories; seven stages due to the two article-al phases; precision ahead of speed.
- Human-controlled candidate/source/evidence → item annotation → manifest review → session-policy rebuild, all fail-closed.
- Mature automated content/learning/session/persistence/browser/worker CI exists; no claim of completion of outstanding human review.
- Code agent work must use isolated branches and PRs; no direct `main` writes.

## Open substantive blockers at initial audit

- #152: qualified-human Arabic content verification.
- #154: V1 release readiness.
- #207 / #208: progression, repetition and stage/corpus improvements.
- #213: controlled source transcription intake.
- #235: isolated qamariyyah pool source gap; never invent material.
- Existing wave orchestration is observe-only with no verified Codex dispatcher.
- Existing GitHub account has no observed enforced protection on main; connector cannot configure it.
- Cron-based audit cannot run from a non-default branch; production deployment is triggered by main pushes.

## Current engineering mission

`agents/itqan-push-ci-checkpoint`: require a completed successful **push** run (not a PR run) for the exact current integration SHA, add tests for PR-only and misleading newer PR CI, and update runbook. Status: **changes proposed; verification and integration pending**. The previous orchestration-hardening work was merged through PRs #252, #255 and #256, with the latest verified integration SHA recorded above.

## Next safe work

1. Verify PR CI for `agents/itqan-push-ci-checkpoint` on its exact head SHA and review the diff.
2. Reconfirm integration HEAD freshness; only then merge safely into `integration/itqan-autonomous`, never into `main`.
3. Verify the integration **push** CI and read-only audit after merge before setting a newer green checkpoint.
4. Continue low-risk security and reliability improvements with tests; leave the Arabic human gates closed.
5. GitHub branch protection and default-branch scheduled audit activation remain separate human-admin/release decisions. A paid write-capable Codex runner remains unconfigured.

## Required status for every later handoff

Record date; main/integration exact SHAs; last green CI run ID and SHA; PRs/head/base freshness; tests actually run; changes implemented; unresolved human/content/security blockers; autonomous runner mode; next mission. Do not report a stale green run as validating a newer commit.
