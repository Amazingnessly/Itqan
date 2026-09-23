# V1 release audit — issue #199

Audit date: 2026-09-23  
Original Wave 1 audit base: `546c7e3948eb5d97b18eae56197dd76360a97327`  
Final integration base before these release-audit changes: `36b1422c1c611f15df5db91102c11747d67358bf`  
Audit scope: technical, non-linguistic release readiness only.

## Decision

V1 is **not ready to be declared released** from this audit alone.

- **Verified:** the controlled-content, learning-policy, persistence, session-engine, voice-policy, build, and structural human-review guards exercised locally pass after the technical remediation in this branch.
- **To verify in CI:** the production browser journey requires Chrome/Chromium, which is not installed in the audit environment. The production build completed, then the browser audit stopped before opening the application because no browser binary was available.
- **To verify in CI/deployment:** the Cloudflare dry run and production deployment evidence must be produced by an environment with registry and Cloudflare access.
- **Human-only blocker:** all 21 active sessions remain `PENDING QUALIFIED HUMAN REVIEW`. Issue #152 remains the sole authority for linguistic approval; this audit neither edits that record nor infers Arabic correctness from automated checks.

## Technical blocker found and treated

The TypeScript test commands invoked an undeclared `tsx` package through `npx --yes`. A clean checkout therefore depended on an on-demand registry download after `npm ci`; in the audit environment that download returned HTTP 403, preventing the release suite from starting even though the repository dependencies had installed successfully.

The final integration branch replaces that network-dependent test runner with a small repository-local Node loader. It uses the already locked `typescript` dependency to transpile test modules, resolves the extensionless TypeScript imports used by the application, and loads imported controlled JSON without changing its bytes. Package scripts, CI, and this runbook now call the same local runner. The affected suites were verified with Node `v22.22.2`, matching the CI major version.

No controlled manifest, Arabic exercise string, blueprint, activation record, human-review verdict, or linguistic status was changed.

## Evidence summary

### Verified locally

- clean dependency installation with `npm ci`;
- all validators required by `AGENTS.md`;
- interaction-mode and lesson-presentation coverage;
- learning policy and seven-stage controlled-path reachability;
- mastery, persistence, session-engine, and voice Worker safety suites;
- structural human-review record and generated review-surface coverage;
- production TypeScript/Vite build;
- wave orchestrator, planner, activation, and handoff safety suites.

### Still required before a V1 release decision

1. Green `Itqan CI` on the exact pull-request candidate SHA, including the Chrome-backed production learner-journey audit.
2. Successful Cloudflare Worker dry run, production deployment, production shell smoke, and rendered production journey smoke for the release candidate.
3. Completion of issue #152 by a qualified human, followed by `npm run validate:v1-human-review-complete`.
4. Recorded release evidence as required by `docs/V1_RELEASE_READINESS.md`.

The qualified-human completion validator was intentionally not used as a technical workaround: pending review is an expected release blocker, not a failing implementation to bypass.
