# Cloud staging (zero-budget target)

This is a **non-production demo environment**. Never use real treasury, bank, employee, or payment data.

## Hosting decision

The requested Netlify/Vercel + Railway combination does not meet a hard Rp0 budget for several months:
- Railway's Free tier is $0 but includes only $1 monthly resource credit; a new trial is a one-time $5 for 30 days. Railway documents a 0.5 GB RAM / 1 vCPU per-service limit on Free. Keycloak + API are not a safe assumption within that allowance. See https://docs.railway.com/pricing/plans and https://docs.railway.com/pricing/free-trial.
- Netlify Free is $0 with a 300-credit monthly limit; a site pauses when the limit is reached. See https://www.netlify.com/pricing/.
- Neon Free includes 100 CU-hours and 1 GB storage per project; compute scales to zero after inactivity. See https://neon.com/docs/introduction/prod-vs-dev.

For a multi-month Rp0 target, use:
- Netlify Free for the Vite static frontend.
- Oracle Cloud Always Free VM for Dockerized NestJS API + Keycloak + Caddy TLS reverse proxy.
- Neon Free PostgreSQL for the application database (and a separate database for Keycloak).
- GitHub Actions for CI and remote Playwright E2E.

OCI Always Free Ampere A1 allocation currently documents 1,500 OCPU-hours and 9,000 GB-hours/month (equivalent to 2 OCPUs + 12 GB RAM). It must be created in the tenancy home region; capacity is not guaranteed. Check https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm. Set a budget alert and compartment quotas. This design is free only while every resource remains within Always Free allowances; never enable paid upgrades or overages.

## Topology

```
Browser
  | HTTPS
  v
Netlify (React + Vite)
  |                         |
  | https://api.<domain>    | https://auth.<domain>
  v                         v
Caddy on OCI VM -------------+
  | /                         | /
  v                           v
NestJS API                 Keycloak 26.3
  |                           |
  | TLS / sslmode=require     | TLS / sslmode=require
  v                           v
Neon PostgreSQL: treasury    Neon PostgreSQL: keycloak
```

Use two separate Neon databases (or separate Neon projects if isolation is preferred). Do not point Keycloak and Prisma at the same database/schema. Use a custom domain with DNS A records for api and auth to the OCI VM. Netlify can use its generated `.netlify.app` hostname for the first test. Do not use an IP address as an OIDC issuer; issuer URL must match exactly in the JWT's `iss`, API configuration, and browser discovery metadata.

## Netlify configuration

Repository root is the Netlify base directory:
- Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @treasury/web build`
- Publish directory: `apps/web/dist`
- Build environment variables:
  - `VITE_API_BASE_URL=https://api.<your-domain>/api`
  - `VITE_OIDC_URL=https://auth.<your-domain>`
  - `VITE_OIDC_REALM=treasury-dev`
  - `VITE_OIDC_CLIENT_ID=treasury-web`

Vite `VITE_*` values are public and baked into the browser bundle. Never put secrets, database URLs, client secrets, private keys, or admin passwords in them. Keycloak browser client remains public with Authorization Code + PKCE S256; no client secret.

## OCI VM and containers

Create one Always Free Ampere A1 VM in the home region (start with 2 OCPU / 12 GB), Ubuntu LTS, public IPv4, and SSH key authentication. If capacity is unavailable, retry later; do not switch to a paid shape. Configure OCI Security Lists/NSG and host firewall to allow only TCP 22 from your IP, TCP 80 and 443 from the internet. Do not expose 3000, 8080, or PostgreSQL ports.

Install Docker Engine + Compose plugin. Deploy API and Keycloak as containers bound only to the private Docker network; publish Caddy on 80/443. Configure Caddy to reverse proxy:
- `api.<your-domain>` -> API container port 3000
- `auth.<your-domain>` -> Keycloak container port 8080

Caddy obtains and renews TLS certificates automatically after DNS points to the VM and ports 80/443 are reachable. Keep SSH restricted. Enable unattended security updates and reboot planning.

The repository includes `apps/api/Dockerfile`, `deploy/staging/docker-compose.yml`, `deploy/staging/Caddyfile`, and `deploy/staging/.env.example`. On the VM:
1. Clone the repository and check out the approved staging commit.
2. Copy `deploy/staging/.env.example` to `deploy/staging/.env`; replace every placeholder and run `chmod 600 deploy/staging/.env`.
3. Start the services from the repository root:
   `docker compose --env-file deploy/staging/.env -f deploy/staging/docker-compose.yml up -d --build`
4. Check `docker compose --env-file deploy/staging/.env -f deploy/staging/docker-compose.yml ps` and inspect logs if needed.
5. Import `docker/keycloak/treasury-dev-realm.json` through the Keycloak Admin Console, then apply the redirect URI, web origin, and audience settings below.
6. Apply the Prisma migration and seed only after verifying the staging database URL:
   `docker compose --env-file deploy/staging/.env -f deploy/staging/docker-compose.yml exec api pnpm prisma:deploy`
   `docker compose --env-file deploy/staging/.env -f deploy/staging/docker-compose.yml exec api pnpm prisma:seed`
7. Verify the API at `https://api.<your-domain>/api/health` and the realm discovery document at `https://auth.<your-domain>/realms/treasury-dev/.well-known/openid-configuration`.

The API image currently includes build-time dependencies so that Prisma CLI and the checked-in demo seed remain available for controlled staging operations. This is acceptable for a temporary demo but should be slimmed down before production.

Keycloak production-like start options:
- `KC_DB=postgres`
- `KC_DB_URL=jdbc:postgresql://<neon-host>:5432/<keycloak-db>?sslmode=require`
- `KC_DB_USERNAME`, `KC_DB_PASSWORD`
- `KC_HOSTNAME=https://auth.<your-domain>`
- `KC_HTTP_ENABLED=true` (TLS terminates at Caddy)
- `KC_PROXY_HEADERS=xforwarded`
- `KC_BOOTSTRAP_ADMIN_USERNAME`, `KC_BOOTSTRAP_ADMIN_PASSWORD`
- start with `start` (not `start-dev`); pin the tested Keycloak image version.

For Keycloak's database, allow Neon SSL and ensure the JDBC URL syntax is accepted by the selected Neon connection endpoint. Use a pooled connection only if supported by Keycloak's JDBC driver; otherwise use the direct endpoint.

## API environment (OCI secret file / deployment environment)

Set these on the API container only:
- `NODE_ENV=production`
- `PORT=3000` (or `API_PORT=3000`; Nest bootstrap supports both)
- `DATABASE_URL=postgresql://<user>:<password>@<neon-host>:5432/<treasury-db>?sslmode=require&schema=public`
- `WEB_ORIGIN=https://<netlify-site>.netlify.app` (exact origin; add custom frontend origin if later used)
- `OIDC_ISSUER=https://auth.<your-domain>/realms/treasury-dev`
- `OIDC_AUDIENCE=treasury-api`
- `OIDC_JWKS_URI=https://auth.<your-domain>/realms/treasury-dev/protocol/openid-connect/certs`

Set Netlify's `VITE_*` variables separately and trigger a fresh build after changes. CORS must use the exact deployed frontend origin.

## Secrets and access controls

Keep secrets only in OCI deployment environment/secret files with permissions 600, never in Git, Netlify, client-side Vite variables, Docker image layers, or CI logs:
- Treasury Neon username/password and full DATABASE_URL.
- Keycloak Neon username/password and JDBC URL.
- Keycloak bootstrap admin password.
- OCI SSH private key (store locally; do not upload into the app).
- GitHub deployment SSH private key only if CI deploy is later enabled; prefer a dedicated restricted deploy key.

Use separate strong random passwords for DBs and Keycloak admin. Rotate the bootstrap admin password after first login, create a named admin account, and disable/delete bootstrap credentials where appropriate. Demo accounts/passwords from the checked-in realm/seed are public test identities: use only in the demo realm, rotate them for any shared staging, and never reuse them elsewhere.

## Database bootstrap and migration

1. Create Neon project in a region close to the OCI VM; create separate `treasury_staging` and `keycloak_staging` databases/roles.
2. Save direct connection strings with TLS required.
3. From a controlled deployment shell, run:
   - `pnpm --filter @treasury/api prisma:validate`
   - `pnpm --filter @treasury/api prisma:generate`
   - `pnpm --filter @treasury/api prisma:deploy`
4. Run `pnpm --filter @treasury/api prisma:seed` **only** against the disposable staging database. It creates fixed demo identities and demo companies/rules; never run against production.
5. Verify `GET /api/health`, `GET /api/companies/mine` after Keycloak login, then execute maker -> checker -> admin test.
6. Enable Neon point-in-time recovery only if available in the selected plan; otherwise schedule logical `pg_dump` backups to a private location and periodically test restore. Do not assume free plan provides PITR.

The initial Prisma migration is a new-database baseline. Do not apply it blindly to a populated database.

## Keycloak realm and client

Import `docker/keycloak/treasury-dev-realm.json` into the staging Keycloak instance. Update the public client `treasury-web`:
- Client authentication: OFF (public client).
- Standard flow: ON.
- PKCE method: S256.
- Valid redirect URIs: exact Netlify URL and any explicit preview URL pattern needed for testing.
- Web origins: exact Netlify origin.
- Root/home URL: deployed frontend URL.
- API audience: `treasury-api` must be present in access tokens (retain existing audience mapper).

Do not use broad wildcard redirect URIs in a shared environment. If Netlify deploy previews are enabled, prefer a separate preview client/realm or tightly scoped preview origin policy rather than `*`.

## CI/CD and Playwright staging

Keep the existing GitHub Actions CI isolated and disposable: it provisions PostgreSQL + Keycloak, seeds test data, and runs Playwright. It must not use the staging database.

Recommended pipeline:
1. Pull request: install, Prisma validate/generate, API tests/build, frontend build/unit tests, Keycloak realm JSON validation, Playwright against disposable local services.
2. Merge to main: deploy frontend via Netlify Git integration; deploy OCI containers by a manually triggered SSH workflow only after secrets and host hardening are configured.
3. Staging E2E: a separate manually triggered workflow accepts `PLAYWRIGHT_BASE_URL` and executes Playwright against the deployed Netlify URL. Tests must use staging-only credentials and data. Never print tokens or passwords.
4. For remote E2E, add GitHub Actions secrets:
   - `STAGING_BASE_URL`
   - `E2E_MAKER_USERNAME`, `E2E_MAKER_PASSWORD`
   - `E2E_CHECKER_USERNAME`, `E2E_CHECKER_PASSWORD`
   - `E2E_ADMIN_USERNAME`, `E2E_ADMIN_PASSWORD`
   Remote E2E needs test isolation/cleanup or a resettable staging database; avoid running multiple workflows concurrently against the same test records.
5. Run staging E2E after a deployment is healthy. Retain Playwright HTML report and trace artifacts on failure.

Before enabling automated deploy, add health checks and rollback instructions. For the first staging rollout, deploy manually from a tagged commit and validate before enabling continuous deployment.

## Operational constraints

- This is a learning/UAT staging environment, not production.
- Free-tier limits, regional capacity, account verification, and service terms can change. Confirm current allowances before provisioning.
- OCI free compute may be unavailable due to host capacity; do not choose a paid shape if Rp0 is mandatory.
- Neon scales to zero after inactivity, so first request/DB access may have cold-start latency.
- Netlify Free has a monthly credit cap; monitor usage and stop previews/traffic if approaching it.
- Keep demo-only seed data. No email notifications, Oracle EBS, or SAP integrations are part of this deployment.
