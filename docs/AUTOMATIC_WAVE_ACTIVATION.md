# Itqān automatic wave activation contract

The orchestrator may advance from observe-only planning to dispatch only when every condition below is mechanically true.

- The wave base SHA equals the current `main` SHA.
- The preceding Itqan CI conclusion is `success`.
- At most four tasks are selected and every task kind is allowlisted by the planner.
- Every task carries `no-arabic-authoring`, `no-guard-weakening`, `branch-and-pr-only`, and `fresh-main-required`.
- Dispatch creates isolated work only; it cannot merge.
- Integration remains sequential and each candidate must receive fresh CI on the exact candidate SHA.
- Issue #152 and Arabic linguistic approval remain human-only and cannot be satisfied, edited, or inferred by the orchestrator.
- Any stale base, guard regression, persistent CI failure, product ambiguity, or lack of safe work stops the wave.

## Capability boundary

The repository currently has a safe planner but no authenticated Codex task-dispatch capability. Therefore `dispatchEnabled` must remain false until a reviewed runner/app capable of creating Codex tasks is explicitly connected. GitHub Actions must not simulate an agent by directly editing product files.

Automatic merging remains disabled independently of dispatch activation.
