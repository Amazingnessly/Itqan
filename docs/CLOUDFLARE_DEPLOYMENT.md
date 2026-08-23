# Itqān — Cloudflare deployment

Itqān is a Vite/React single-page application. Cloudflare Workers serves the production `dist` directory as static assets.

## Repository configuration

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Static asset directory: `dist`
- SPA fallback: enabled through `not_found_handling: "single-page-application"`
- Production branch: `main`

## Git integration target

Connect the GitHub repository `Amazingnessly/Itqan` to Cloudflare Workers Builds.

Recommended policy:

- `main` is the production branch;
- pull-request/feature branches are used for preview deployments;
- GitHub CI must pass before a feature PR is merged;
- Cloudflare deployment does not replace the controlled-content validators.

## Local/agent commands

```bash
npm ci
npm run build
npm run cf:dev
```

Production deployment, when Cloudflare credentials are available to the deployment environment:

```bash
npm run cf:deploy
```

## Security

Do not put speech-provider keys or other secrets in Vite client environment variables. Future speech assessment endpoints must keep provider credentials server-side in Cloudflare secrets/bindings.
