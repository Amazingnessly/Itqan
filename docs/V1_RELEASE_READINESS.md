# Itqān V1 release readiness

This runbook is the release gate for calling V1 ready. It does not replace or weaken any controlled-content, pedagogical, runtime-integrity, or deployment guard.

## 1. Release candidate

Choose the exact commit intended for release. Record its SHA in the release evidence. All checks below must apply to that commit, or to the merge commit produced from a PR whose required checks were green.

Do not call V1 ready while either of these release gates remains incomplete:

- #152 — human review of active controlled Arabic content;
- #153 — end-to-end learner journey release audit.

Any blocker or critical regression also blocks release.

## 2. Controlled content and runtime integrity

Run from a clean checkout:

```bash
npm ci
node scripts/validate-controlled-content.mjs
node scripts/validate-batch02.mjs
node scripts/validate-blueprints-no-arabic.mjs
node scripts/validate-learning-engine-no-arabic.mjs
node scripts/validate-blueprint-crossrefs.mjs
npm run test:interaction-modes
node scripts/validate-active-session-policy.mjs
npm run test:activation-policy
npm run test:source-traceability
node scripts/validate-timing-policy-wiring.mjs
node scripts/validate-ui-no-arabic-content.mjs
node scripts/validate-batch05-no-arabic.mjs
node scripts/validate-batch05-connections.mjs
node scripts/validate-batch06-no-arabic.mjs
node scripts/validate-batch06-visual-contract.mjs
node scripts/validate-session-progression.mjs
npm run test:learning
npx --yes tsx scripts/test-controlled-path-reachability.ts
npm run test:mastery
npm run test:persistence
npm run test:session-engine
npm run test:worker
npm run audit:v1-journey
npx --yes wrangler@4 deploy --dry-run
```

`npm run audit:v1-journey` performs the production build before exercising the real browser journey, so a separate `npm run build` is not required in this clean-checkout sequence.

The GitHub Actions `Itqan CI` workflow runs the same release-validation surface on pull requests to `main` and pushes to `main`, with the production build followed by the V1 browser audit. A green workflow is required evidence; a local run does not justify bypassing a failed CI check.

The active-session manifest, blueprints, controlled manifests, generated integrity/attempt/source-traceability registries, item IDs, sequences, fingerprints, eligibility, and activation must remain mutually consistent. Fail closed on a mismatch. Never invent, normalize, substitute, or activate Arabic strings to make this gate pass.

## 3. Human Arabic-content gate

#152 must be completed with explicit human-review evidence/status for every active controlled session. Existing automated guards, hashes, visual-pass flags, or model inspection do not substitute for the qualified human review required by that issue.

Use `docs/V1_ARABIC_HUMAN_REVIEW.md` as the review record. It intentionally starts with every session marked `PENDING QUALIFIED HUMAN REVIEW`; only a qualified reviewer may replace those statuses with review outcomes and evidence.

Corrections must use the controlled-content workflow and preserve source traceability. If a source is ambiguous, report it as `blocked by ambiguous source`; do not guess.

## 4. Learner-journey gate

#153 must be completed against the production build. Exercise the real UI across all six authorized categories:

`reading_units`, `vowels_sukun`, `shaddah`, `article_al`, `linking`, `fluent_reading`.

The audit must cover start/resume → lesson → VOIR → DÉCOMPOSER → PRONONCER → FLUIDIFIER → feedback → progression → interruption/recovery → delayed verification → mastery-state behavior.

Verify at minimum a narrow mobile viewport and a representative desktop viewport, including primary-action visibility, horizontal overflow, RTL/Arabic rendering, focus/keyboard behavior, persistence/recovery through the real UI, delayed verification, and mastery-state semantics. Record reproducible issues for failures.

## 5. Production deployment gate

A push to `main` triggers `Deploy Itqan to Cloudflare`. For the release commit, require:

1. production build success;
2. Cloudflare Worker deployment success;
3. production shell smoke success;
4. rendered production journey smoke success.

The canonical production target used by the workflow is `https://itqan.gassamasa.workers.dev/`.

Do not infer production readiness from a preview deployment alone.

## 6. Release evidence and decision

Record the release commit SHA and links/identifiers for:

- green `Itqan CI` run;
- successful Cloudflare production deployment run;
- completed #152 evidence;
- completed #153 audit;
- any accepted non-blocking known issues.

Use the repository quality vocabulary precisely: `verified`, `implemented but not tested`, `to verify`, `blocked by ambiguous source`.

V1 may be marked ready only when all required gates above are verified on the release candidate and there is no open blocker or critical regression.