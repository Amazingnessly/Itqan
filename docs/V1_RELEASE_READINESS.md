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
npm run validate:v1-human-review
npm run test:v1-human-review
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

`npm run validate:v1-human-review` is structural only: it verifies that the human-review record covers exactly the active session set, points to the expected controlled resources, and uses supported evidence statuses. It does not validate Arabic correctness and is allowed to pass while rows remain `PENDING QUALIFIED HUMAN REVIEW`.

`npm run audit:v1-journey` performs the production build before exercising the real browser journey, so a separate `npm run build` is not required in this clean-checkout sequence.

The GitHub Actions `Itqan CI` workflow runs the same release-validation surface on pull requests to `main` and pushes to `main`, with the production build followed by the V1 browser audit. A green workflow is required evidence; a local run does not justify bypassing a failed CI check.

The active-session manifest, blueprints, controlled manifests, generated integrity/attempt/source-traceability registries, item IDs, sequences, fingerprints, eligibility, and activation must remain mutually consistent. Fail closed on a mismatch. Never invent, normalize, substitute, or activate Arabic strings to make this gate pass.

## 3. Human Arabic-content gate

#152 must be completed with explicit human-review evidence/status for every active controlled session. Existing automated guards, hashes, visual-pass flags, or model inspection do not substitute for the qualified human review required by that issue.

Use `docs/V1_ARABIC_HUMAN_REVIEW.md` as the review record. It intentionally starts with every session marked `PENDING QUALIFIED HUMAN REVIEW`; only a qualified reviewer may replace those statuses with review outcomes and evidence.

After the qualified reviewer has completed the record, run:

```bash
npm run validate:v1-human-review-complete
```

This command verifies only that reviewer metadata is traceable, every active session has a supported completed status and evidence reference, no pending/correction/ambiguous-source blocker remains, and the overall recorded outcome is `VERIFIED BY QUALIFIED HUMAN`. It does not independently validate Arabic correctness; that remains the qualified reviewer’s responsibility.

Corrections must use the controlled-content workflow and preserve source traceability. If a source is ambiguous, report it as `blocked by ambiguous source`; do not guess.

## 4. Learner-journey gate

#153 must be completed against the production build. Exercise the real UI across all seven learner-facing pedagogical stages while retaining the six authorized data categories:

1. `reading_units`;
2. `vowels_sukun`;
3. `article_al` — qamariyyah phase;
4. `shaddah`;
5. `article_al` — shamsiyyah phase;
6. `linking`;
7. `fluent_reading`.

Both `article_al` phases must be exercised separately. A journey that visits the category only once does not prove the required qamariyyah → shaddah → shamsiyyah progression.

The audit must cover start/resume → lesson → VOIR → DÉCOMPOSER → PRONONCER → FLUIDIFIER → feedback → progression → interruption/recovery → delayed verification → mastery-state behavior.

Verify at minimum a narrow mobile viewport and a representative desktop viewport, including primary-action visibility, horizontal overflow, RTL/Arabic rendering, focus/keyboard behavior, persistence/recovery through the real UI, delayed verification, stage-boundary locking/unlocking, and mastery-state semantics. Record reproducible issues for failures.

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
