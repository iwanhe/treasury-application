# Treasury Application — User Trial Guide

This guide starts a local demo environment for business-user acceptance testing. It is **not** a production deployment. The demo realm uses temporary shared passwords and local HTTP endpoints.

## 1. Prerequisites

- Docker Desktop / Docker Engine with Compose
- Node.js 22 or later
- pnpm 10.18.0 (run `corepack enable` and `corepack prepare pnpm@10.18.0 --activate` if needed)
- A browser (Chrome, Edge, or Firefox)

## 2. Start PostgreSQL and Keycloak

From the repository root:

```bash
docker compose up -d postgres keycloak
docker compose ps
```

Wait until PostgreSQL and Keycloak are healthy. Keycloak imports the `treasury-dev` realm and three demo identities on first startup. Open [http://localhost:8080](http://localhost:8080) to confirm Keycloak is reachable.

> If Keycloak has already initialized a persistent data directory/volume before these demo users were added, realm import may not run again. For a brand-new disposable demo, `docker compose down -v` followed by `docker compose up -d postgres keycloak` resets **all** Compose volumes, including the PostgreSQL database. Do not run this against data you need to keep.

## 3. Configure and initialize the API

Copy `apps/api/.env.example` to `apps/api/.env`. The example values are for local development only.

```bash
pnpm install
pnpm --filter @treasury/api prisma:generate
pnpm --filter @treasury/api prisma:deploy
pnpm --filter @treasury/api prisma:seed
```

The seed is repeatable and provisions two demo companies, three users, company roles, and two-step IDR approval rules for every supported request type. It uses fixed Keycloak subject IDs from the imported development realm. Do not run this demo seed in a production database.

## 4. Configure and start the web app

Copy `apps/web/.env.example` to `apps/web/.env.local`. Confirm it points to:

- API: `http://localhost:3000/api`
- Keycloak: `http://localhost:8080`
- Realm: `treasury-dev`
- Client: `treasury-web`

Start the API in one terminal:

```bash
pnpm dev:api
```

Start the web app in another terminal:

```bash
pnpm dev:web
```

Open [http://localhost:5173](http://localhost:5173). The API health endpoint is [http://localhost:3000/api/health](http://localhost:3000/api/health).

## 5. Demo accounts

All accounts use the same temporary password: `ChangeMe123!`. Keycloak requires a password change at first login. Use distinct browser profiles or sign out between roles.

| Username | Purpose | Company roles |
|---|---|---|
| `treasury.maker` | Create and submit requests | REQUESTER, TREASURY_MAKER |
| `treasury.checker` | First approval step | TREASURY_CHECKER |
| `treasury.admin` | Second approval step and rule administration | ADMIN, APPROVER, REQUESTER |

All three users have access to Demo Company A and Demo Company B. Demo data is shared within this local environment.

## 6. End-to-end business trial

1. Sign in as `treasury.maker`.
2. Select **Demo Company A**.
3. Create a ticket. For the seeded route, use currency **IDR** and any non-negative amount. Choose a request type, e.g. **Financial Investment**.
4. Save the draft, reopen it, and edit it. Submit the ticket.
5. Sign out and sign in as `treasury.checker`. Open **Approval Inbox** and approve the first step.
6. Sign out and sign in as `treasury.admin`. Approve the second step. The ticket should become **APPROVED**.
7. Repeat with a new ticket, but choose **Return** at the checker step. Sign back in as maker, edit the returned ticket, and resubmit. The new approval cycle should start at step 1; the prior cycle remains in approval history.
8. Try the second company to confirm the company selector and data scope.
9. As admin, review and change company approval rules. The seeded rules are intended as demo defaults.

## 7. What is included in this trial

- OIDC login through a local Keycloak development realm
- Company-scoped user access and roles
- Draft creation, editing, submission, cancellation, and ticket detail
- Sequential maker-checker approvals, rejection/return, and resubmission cycles
- Company-specific approval rules and global fallback display
- Audit events for ticket and approval actions
- Automated API tests, frontend unit tests, and CI builds

## 8. Known limitations — not yet production-ready

- Local Keycloak and demo credentials are for trial only. Production requires corporate SSO/Entra ID or hardened Keycloak, MFA, TLS, secret rotation, user lifecycle synchronization, and access reviews.
- No production hosting, DNS, TLS, WAF, backup/restore drill, or observability stack is provisioned by this repository.
- Oracle EBS, SAP, bank APIs, email notifications, attachments, SLA automation, and Excel export are not yet implemented as end-to-end integrations.
- Approval rules are seeded for IDR. Configure additional currencies and amount bands only after validating the approval policy with Treasury owners.
- The initial database migration is a development baseline. Do not apply it blindly to an existing/populated production database; create and validate a baseline adoption plan first.
- The current UI is an MVP for workflow validation, not a full treasury operations console.

## 9. Troubleshooting

- **Login succeeds but app says user is not provisioned:** check that the demo seed ran after migrations and that the Keycloak realm import contains the fixed user IDs. The API maps the token `sub` to `User.externalId`.
- **No company appears:** run the API seed again and verify the signed-in account is one of the three demo identities.
- **Approval Inbox is empty:** confirm the ticket was submitted, the user is `treasury.checker` or `treasury.admin`, and the ticket is not the user's own request.
- **CORS error:** confirm `WEB_ORIGIN=http://localhost:5173` in `apps/api/.env` and restart the API.
- **Keycloak issuer/JWKS error:** keep the local issuer and JWKS URLs exactly as shown in `apps/api/.env.example`; do not mix `localhost` with the Docker service hostname in the local host-run API setup.
- **Port already in use:** stop the process using 3000, 5173, 5432, or 8080, or adjust the local configuration consistently.


## 7. Automated browser E2E tests

The repository includes Playwright browser coverage for the main approval lifecycle. CI starts a disposable PostgreSQL database and imported Keycloak realm, applies the demo seed, resets the three demo passwords to non-temporary values inside that disposable realm, starts the API and Vite app, then runs Chromium.

Run locally after starting PostgreSQL, Keycloak, applying migrations, and seeding the database:

```bash
pnpm --filter @treasury/web exec playwright install chromium
pnpm --filter @treasury/web test:e2e
```

The browser test uses the three demo accounts and verifies:
- Maker creates and submits two IDR tickets.
- Checker approves one ticket and returns the other.
- Maker edits the returned ticket and resubmits it.
- Checker and Admin complete the sequential approval.
- The final ticket status and approval history are visible.

The E2E test is destructive to the demo workflow data (it creates tickets). Use a disposable database and Keycloak realm, not shared or production data. CI resets demo passwords only in its isolated Keycloak container; the local realm continues to require the password change configured by the realm import.

Playwright reports and traces are uploaded by CI when the browser test job fails.
