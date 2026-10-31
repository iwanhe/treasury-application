# Vercel Hobby POC deployment

This deployment profile is for a personal demonstration using synthetic data only.
It is not approved for company business use, operational Treasury workflows, or real financial/personnel data.

## Deployment topology

Use two Vercel projects connected to this repository:

- Web project Root Directory: `apps/web`
- API project Root Directory: `apps/api`
- Both projects use the same branch: `feature/vercel-hobby-poc`
- API uses Neon PostgreSQL. Use the pooled connection string for runtime and the direct connection string for Prisma migration commands.

## Web project

- Framework preset: Vite
- Build command: `pnpm --filter @treasury/web build`
- Output directory: `dist`
- Install command: `pnpm install --frozen-lockfile`
- Environment variable: `VITE_API_BASE_URL` = the deployed API base URL including `/api`

The SPA rewrite is provided by `vercel.json`.

## API project

- Framework preset: Other
- Build command: `pnpm --filter @treasury/api build`
- Install command: `pnpm install --frozen-lockfile`
- Runtime entrypoint: `api/index.ts`
- Environment variables required at runtime:
  - `DATABASE_URL`: Neon pooled connection string
  - `DIRECT_URL`: Neon direct connection string (needed by Prisma CLI/migrations; do not expose to the browser)
  - `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URI`: current Keycloak settings
  - `WEB_ORIGIN`: exact deployed web origin

The serverless adapter initializes one Nest application per warm function instance. No persistent local filesystem or in-process session storage should be used.

## Current blockers before public demo

1. The web application currently requires Keycloak login. A dedicated, server-verified demo sign-in flow has not yet been implemented. Do not bypass the guard or accept browser-supplied user IDs/roles.
2. Verify Prisma migration history against the actual Neon schema with Prisma CLI before running any migration.
3. Verify API and web builds, unit/integration tests, and Playwright E2E in CI.
4. Configure Vercel environment variables through the Vercel dashboard/secure environment API. Never commit secrets.
5. Disable attachment upload until durable object storage is configured. Vercel function filesystem is ephemeral.
6. Use synthetic demo identities and records only.

## Database migration safety

Do not run `prisma migrate dev` or `prisma migrate deploy` against the populated Neon database until `prisma migrate status` confirms the migration history is consistent. The existing initial migration was applied manually and the migration tracking row requires CLI verification.

## Scope exclusions

Oracle EBS, SAP, email notifications, production SSO changes, and company data are out of scope.
