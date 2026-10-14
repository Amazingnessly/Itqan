# Itqān — persistent orchestration checkpoint

Last audit date: 2026-10-15 (Europe/Paris). This record is a handoff, not a declaration that any untested change works.

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
**Last green integration checkpoint: NONE RECORDED HERE** — it must be confirmed from exact-SHA GitHub CI after the bootstrap and after any future integration merge.

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

`agents/itqan-orchestration-hardening`: remove workflow-dispatch input shell injection, add exact-SHA read-only audit with unit tests, document re-entry/guard policy and initialize PR into integration. Status: **in progress until exact SHA CI and review**. Never record it as completed simply because a commit exists.

## Next safe work

1. Verify CI result on the integration-bootstrap SHA.
2. Verify PR CI on exact head SHA and review the security/audit diff.
3. If checks all pass, integrate sequentially into `integration/itqan-autonomous` (never main), then verify fresh push CI.
4. Record post-merge integration checkpoint and preserve the audit artifact.
5. Continue security/infrastructure robustness (especially restrictions and budget before paid agent dispatch); human Arabic gates stay closed.
6. Enabling scheduled runs on the default branch and production deployment requires separate owner approval.

## Required status for every later handoff

Record date; main/integration exact SHAs; last green CI run ID and SHA; PRs/head/base freshness; tests actually run; changes implemented; unresolved human/content/security blockers; autonomous runner mode; next mission. Do not report a stale green run as validating a newer commit.
