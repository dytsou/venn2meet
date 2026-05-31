# Venn2Meet

Anonymous overlap scheduling built on Cloudflare Workers + D1.

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

## Required secrets

- `SESSION_SECRET` (Wrangler secret) used to sign participant session cookies.
- `.env` — local Wrangler auth and D1 binding (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`); gitignored.
- GitHub Actions deployment workflow secrets:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
  - `D1_DATABASE_ID`

## Validation

- Automated: `pnpm test`
- Manual acceptance checklist: `test/e2e-manual-checklist.md`
