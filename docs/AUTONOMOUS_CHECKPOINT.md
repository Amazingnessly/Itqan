# Itqān — persistent orchestration checkpoint

Last audit date: 2026-10-21 (Europe/Paris). This record is a handoff, not a declaration that any untested change works.

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

## Most recent verified integration checkpoint (2026-10-21 read)

- Integration HEAD: `07242f907ee84f8f4c448558acba0b1390f99f9d` (merged PR #257).
- [Exact-SHA post-merge `push` CI completed with success](https://github.com/Amazingnessly/Itqan/actions/runs/39467683495).
- [Read-only integration audit completed with success](https://github.com/Amazingnessly/Itqan/actions/runs/39467683497); its captured `integrationState` was `verified_by_ci` for this SHA.
- Main HEAD remains `38375253f63590b48866bf5c762c7fe44795db01`; no open PRs at the initial 2026-10-21 audit.
- Branch `agents/itqan-audit-missing-ci-poll` exists from that integration SHA, but changes in that branch are **not** a verified checkpoint until their own PR has exact-head green CI, a safe integration merge and green post-merge checks.
- Human Arabic-content reviews, repository-admin branch protection, paid Codex dispatch and default-branch scheduled GitHub audit remain separate blocked gates. No production/main changes are permitted.

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

`agents/itqan-audit-missing-ci-poll`: fix the read-only audit race when a fresh integration commit has no visible CI push run yet. Poll for the missing exact-SHA run within the existing finite budget; never poll through a terminal failure. Add regression tests. Status: **proposed on isolated branch, exact-head and post-merge CI still required**. PR #257 was successfully integrated and verified on SHA `07242f907ee84f8f4c448558acba0b1390f99f9d`.

## Next safe work

1. Verify the pending missing-CI-poll correction PR on its exact head SHA, with tests and diff review.
2. Reconfirm that `integration/itqan-autonomous` still points at the verified base; merge only to integration and only after all required checks succeed.
3. Require a new successful exact-SHA **push** CI and read-only audit, then record a new checkpoint; never reuse earlier green runs.
4. Retain all Arabic human-only gates; do not change `main`, production or another project.
5. GitHub branch protection and default-branch scheduled audit activation remain separate human-admin/release decisions. A paid write-capable Codex runner remains unconfigured.

## Required status for every later handoff

Record date; main/integration exact SHAs; last green CI run ID and SHA; PRs/head/base freshness; tests actually run; changes implemented; unresolved human/content/security blockers; autonomous runner mode; next mission. Do not report a stale green run as validating a newer commit.
