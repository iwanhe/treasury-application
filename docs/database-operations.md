# Database setup and operations

## Local development

1. Copy the root `.env.example` to `.env`; replace secrets for any shared environment.
2. Start PostgreSQL: `docker compose up -d postgres`.
3. Install workspace dependencies: `corepack enable && pnpm install`.
4. Validate and generate Prisma Client:
   `pnpm --filter @treasury/api prisma:validate`
   `pnpm --filter @treasury/api prisma:generate`
5. Create the first migration from the schema:
   `pnpm --filter @treasury/api prisma:migrate --name init`
6. Load development fixtures:
   `pnpm --filter @treasury/api prisma:seed`

The migration command requires a reachable PostgreSQL instance and creates a migration directory. Commit that generated directory. Production deployment must use `prisma migrate deploy`, never `migrate dev`.

## Development seed

The seed creates five roles, two demo companies, and one development-only administrator identity with ADMIN membership in both companies. It creates no password and does not implement login. Do not use the `example.test` identity in production.

## Company authorization contract

- Authenticate the user first (planned OIDC/SSO guard).
- Extract the immutable internal user ID from the validated principal.
- Resolve accessible companies from UserCompanyRole.
- For every ticket read/write, apply both the requested record identifier and the authorized company scope in the same database query.
- For privileged operations, verify the required role code for that company.
- Reject missing, inactive, or unauthorized memberships; do not silently fall back to a global company scope.

CompanyAccessService is a foundational helper, not a complete authorization system. It must be invoked by controllers/services after authentication is implemented.

## PostgreSQL RLS rollout (not enabled yet)

RLS is intentionally not switched on in this bootstrap. Enabling policies before every API query sets a trusted transaction-local company context can break legitimate requests or cause connection-pool context leakage. Before enabling it:
1. Implement a request-scoped transaction strategy.
2. Set company context with `SET LOCAL` / `set_config(..., true)` inside that transaction.
3. Create policies for every company-owned table, including approval and attachment access paths.
4. Test missing context, invalid company IDs, pool reuse, background jobs and cross-company attempts.
5. Use a restricted application database role and separate migration owner.
6. Verify policy behavior with integration tests against PostgreSQL (not SQLite).
