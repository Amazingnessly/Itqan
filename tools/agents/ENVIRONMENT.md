# Agent execution environment

The supported hosted execution path for the advisory Itqān agent orchestrator is GitHub Actions.

## Secret

Create one repository Actions secret named `OPENAI_API_KEY`.

Do not place API keys in source files, workflow inputs, issue comments, pull requests, commit messages, logs, or documentation.

## Execution

Use the manual `Run Itqan agents` workflow and supply only the task text as the workflow input.

The workflow:

- checks out the repository;
- uses Node.js 22;
- refuses to run if `OPENAI_API_KEY` is absent;
- installs dependencies only inside `tools/agents`;
- syntax-checks the orchestrator;
- runs the four specialists and final coordinator;
- uses a read-only GitHub token (`contents: read`).

This keeps the first live agent stage advisory and prevents the agent process from writing to the repository.
