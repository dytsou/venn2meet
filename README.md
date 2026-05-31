# Venn2Meet

Anonymous overlap scheduling built on Cloudflare Workers + D1.

Production: [venn2meet.tsou.me](https://venn2meet.tsou.me)

## Product behavior

- Event link join is anonymous and server-session based.
- API reads are aggregate-only: `n`, `slots`, and `mine`.
- Grid supports perfect, near-perfect, only-missing-me, and my-time overlay.
- Dynamic submitted N recalculates as participants sync.

## Local development

1. Install dependencies: `pnpm install`
2. Start dev server: `pnpm dev`
3. Run tests: `pnpm test`

## Deploy

1. Copy `.env.example` to `.env` and set Cloudflare credentials (or run `wrangler login` in an interactive terminal):
   - `CLOUDFLARE_ACCOUNT_ID` — from the Cloudflare dashboard Overview page
   - `CLOUDFLARE_API_TOKEN` — create at [API tokens](https://dash.cloudflare.com/profile/api-tokens) with **Account → Cloudflare Workers Scripts → Edit** and **Account → D1 → Edit**
   - `D1_DATABASE_ID` — from `pnpm wrangler d1 create venn2meet` or the D1 dashboard
2. Apply schema migrations:
   `pnpm db:migrate`
3. Deploy Worker:
   `pnpm deploy`

## Cloudflare Workers Builds

If you connect the Git repo in the Cloudflare dashboard, use these settings:

| Setting           | Value          |
| ----------------- | -------------- |
| Build command     | `pnpm test`    |
| Deploy command    | `pnpm release` |
| Root directory    | `/`            |
| Production branch | `main`         |

Under **Build variables and secrets**, add:

- `D1_DATABASE_ID` — your remote D1 database UUID

Cloudflare supplies the build API token automatically. Wrangler reads `D1_DATABASE_ID` during `pnpm release` to inject the D1 binding and apply migrations before deploy.

Set `SESSION_SECRET` under the Worker's **Settings → Variables & Secrets** (runtime secret, not a build variable).

GitHub Actions (`.github/workflows/ci.yml`) runs tests only. Deployments are handled by Workers Builds on push to `main`.

## Required secrets

- `SESSION_SECRET` (Wrangler secret) used to sign participant session cookies.
- `.env` — local Wrangler auth and D1 binding (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`); gitignored.
- Cloudflare Workers Builds build variable:
  - `D1_DATABASE_ID`

## Validation

- Automated: `pnpm test`
- Manual acceptance checklist: `test/e2e-manual-checklist.md`
