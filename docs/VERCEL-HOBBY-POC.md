# Vercel Hobby POC deployment

This profile is exclusively for a personal demonstration using synthetic data. It must not be used for company operations, business-process testing, real financial/personnel data, or confidential documents.

## Deployment topology

Create two Vercel projects from this repository and pin both to `feature/vercel-hobby-poc` (Settings → Environments → Production → Branch Tracking):

- Web project Root Directory: `apps/web`
- API project Root Directory: `apps/api`
- Enable access to source files outside the root directory where Vercel offers that setting, because this is a pnpm workspace.
- Use the pnpm package manager. The CI workflow generates and commits `pnpm-lock.yaml` on this branch. Once it exists, installs must use `pnpm install --frozen-lockfile`.

The API connects to the existing Neon PostgreSQL database. Runtime uses the pooled connection string. Keep the direct connection string only for controlled Prisma CLI migration work.

## Web project

- Framework preset: Vite
- Build command: `pnpm --filter @treasury/web build`
- Output directory: `dist`
- Install command: `pnpm install --frozen-lockfile`
- Environment variables:
  - `VITE_API_BASE_URL`: deployed API URL including `/api`, e.g. `https://<api-project>.vercel.app/api`
  - `VITE_AUTH_MODE=demo`: enable the personal demo sign-in screen
  - For Keycloak mode, omit `VITE_AUTH_MODE` or set it to `oidc`, and configure `VITE_OIDC_URL`, `VITE_OIDC_REALM`, and `VITE_OIDC_CLIENT_ID`.

The SPA rewrite is provided by `apps/web/vercel.json`.

## API project

- Framework preset: Other (not the NestJS preset; the function entrypoint is `api/index.ts`)
- Build command: `pnpm --filter @treasury/api prisma:generate && pnpm --filter @treasury/api build && mkdir -p public`
- Output directory: `public` (kept empty so no source files are served statically)
- Install command: `pnpm install --frozen-lockfile`
- Function region: `sin1` (same region as the Neon database)
- All paths are rewritten to the `api/index.ts` function by `apps/api/vercel.json`
- Runtime entrypoint: `api/index.ts`
- Environment variables:
  - `DATABASE_URL`: Neon pooled connection string for the `treasury` database (not `neondb`)
  - `DIRECT_URL`: Neon direct connection string; never expose it to the browser
  - `WEB_ORIGIN`: exact web deployment origin, not a wildcard
  - `DEMO_AUTH_ENABLED=true`: explicitly enables demo login
  - `DEMO_TOKEN_SECRET`: random secret of at least 32 characters, unique to this environment
  - `DEMO_ACCESS_CODE`: shared access code of at least 24 characters (prefer 32+ random characters); provide it only to the intended demo user
  - `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URI`: configure these only if Keycloak mode is also required.

The demo login endpoint accepts only the fixed `admin`, `maker`, and `checker` identities. It validates a shared access code, signs a two-hour HS256 JWT on the server, and uses the seeded user's external ID as the subject. The API guard verifies signature, issuer, audience, expiry, and then resolves the active user from PostgreSQL. Company roles are still checked against database memberships; browser-supplied user IDs and roles are not trusted.

The serverless adapter initializes one Nest application per warm function instance. Do not use local filesystem persistence or in-process sessions.

## Current implementation and remaining verification

- Demo login mode is implemented in the web client and API. It is opt-in through environment variables and Keycloak remains the default mode.
- Prisma migration history must be validated with Prisma CLI before any migration command is run against the populated Neon database.
- Build, lint, API tests, web tests, and Playwright E2E must pass before calling the deployment demo-ready.
- Configure all secrets through Vercel's secure environment-variable settings. Never commit credentials.
- Do not enable attachment upload; use only synthetic text data for this POC. Vercel function storage is ephemeral.
- The current app does not yet implement a complete Maker → Approver → Checker → Admin workflow validation in the deployed environment.

## Database migration safety

Do not run `prisma migrate dev` or `prisma migrate deploy` against the populated Neon database until `prisma migrate status` confirms migration history consistency. The initial migration was previously applied manually and the tracking row has not yet been validated through Prisma CLI.

## Scope exclusions

Oracle EBS, SAP, email notifications, production SSO changes, and company data are out of scope.
