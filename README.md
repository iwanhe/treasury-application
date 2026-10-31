# Treasury Application

Enterprise Treasury Service Request and Financial Information Portal.

## Technology
- React 19 + TypeScript + Vite + Ant Design
- NestJS modular monolith REST API
- PostgreSQL 16 + Prisma ORM
- Keycloak OIDC for local development; Microsoft Entra ID is a future provider option
- Docker Compose and GitHub Actions CI

## MVP workflow
- Multi-company access model with company-scoped roles
- Treasury ticket draft, edit, submit, detail, and cancellation
- Sequential approval workflow with maker-checker separation
- Return/reject and resubmission approval cycles
- Company-specific approval rules with global fallback
- Audit events for ticket and approval actions

## Try the application locally

Follow **[docs/user-trial-guide.md](docs/user-trial-guide.md)**. It provisions a local Keycloak realm with demo Maker, Checker, and Administrator accounts, two demo companies, and seeded two-step IDR approval rules. The demo is intended for business-user acceptance testing on a developer machine.

Quick start (see the guide for full instructions):

```bash
docker compose up -d postgres keycloak
pnpm install
# Copy apps/api/.env.example to apps/api/.env
# Copy apps/web/.env.example to apps/web/.env.local
pnpm --filter @treasury/api prisma:generate
pnpm --filter @treasury/api prisma:deploy
pnpm --filter @treasury/api prisma:seed
# Terminal 1: pnpm dev:api
# Terminal 2: pnpm dev:web
```

Open [http://localhost:5173](http://localhost:5173).

## CI

GitHub Actions validates Prisma schema and migrations, API tests/build, demo seed TypeScript, React build and Vitest unit tests, Keycloak realm JSON, and Docker Compose configuration.

## Scope not yet implemented

Production deployment hardening, corporate identity lifecycle, email notifications, SLA automation, attachment upload/scanning, Excel export, and end-to-end Oracle EBS/SAP/bank integrations remain future increments. This repository is **not production-ready**. Do not expose the local development Keycloak realm or reuse demo credentials outside a disposable local environment.

## Security before production

- Corporate SSO/identity lifecycle, MFA, TLS, secrets management, and least privilege
- Company-level authorization verification and segregation-of-duties testing
- Audit retention/immutability policy and security monitoring
- Backup/restore and disaster recovery drills
- Attachment scanning and secure object storage before enabling file uploads
- Penetration testing and operational readiness review
- Database migration baseline/adoption plan for any existing database
