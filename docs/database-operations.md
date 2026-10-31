# Database setup and operations

## Local development

1. Copy root `.env.example` to `.env`; replace secrets in shared environments.
2. Start PostgreSQL: `docker compose up -d postgres`.
3. Enable Corepack and install: `corepack enable && pnpm install`.
4. Validate/generate: `pnpm --filter @treasury/api prisma:validate` then `pnpm --filter @treasury/api prisma:generate`.
5. Create the initial migration against a running local PostgreSQL: `pnpm --filter @treasury/api prisma:migrate --name init`.
6. Commit the generated `apps/api/prisma/migrations` directory.
7. Load fixtures: `pnpm --filter @treasury/api prisma:seed`.

Production deployment must use `prisma migrate deploy`, never `migrate dev`.

## Development seed

Creates five roles, two demo companies and one development-only admin identity with ADMIN membership in both companies. It creates no password and does not implement login. Never use the example.test identity in production.

## Company authorization contract

- Authenticate first (planned OIDC/SSO guard).
- Derive internal user ID from the validated principal.
- Resolve company access through UserCompanyRole.
- Every ticket read/write must filter by both record ID and authorized company scope in the same database query.
- Verify role for privileged actions; reject missing/inactive memberships.
- Never infer authorization from companyId supplied by browser.

CompanyAccessService is a helper, not a complete authorization system. Invoke it after authentication is implemented.

## PostgreSQL RLS rollout (not enabled yet)

RLS remains intentionally disabled until every API query uses a trusted transaction-local company context. Before enabling:
1. Implement request-scoped transaction strategy.
2. Set context with `SET LOCAL` / `set_config(..., true)` inside that transaction.
3. Create policies for every company-owned table, including approval and attachment access.
4. Test missing context, invalid company IDs, pooled connection reuse, background jobs and cross-company attempts.
5. Use a restricted application DB role and separate migration owner.
6. Verify against PostgreSQL integration tests, not SQLite.
