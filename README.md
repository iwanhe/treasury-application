# Treasury Application

Enterprise Treasury Service Request and Financial Information Portal.

## Technology
- React + TypeScript + Vite + Ant Design
- NestJS modular monolith REST API
- PostgreSQL + Prisma ORM
- Redis for background jobs (planned)
- Docker Compose and GitHub Actions
- Keycloak OIDC for local development; Microsoft Entra ID is a future provider option

## MVP scope
- Development authentication foundation
- Multi-company access model
- Treasury service request/ticket management
- Conditional approval workflow foundation
- Treasury dashboard foundation

Planned increments: SLA management, email notifications, financial data upload and viewing, Excel export, Oracle EBS integration, and SAP integration.

## Local development

1. Copy `.env.example` to the API environment file used by your local workflow.
2. Start infrastructure: `docker compose up -d postgres redis keycloak`.
3. Open Keycloak at http://localhost:8080 and select realm `treasury-dev`.
4. Follow [Keycloak development setup](docs/keycloak-development.md) for OIDC configuration and identity provisioning.
5. Copy `apps/web/.env.example` to `apps/web/.env.local`; use `http://localhost:3000/api` as the API base URL.
6. Install dependencies and start the API/web apps using `pnpm dev:api` and `pnpm dev:web`.

The Keycloak realm import includes development-only credentials. Do not expose the development setup publicly or reuse its credentials.

## Repository status
This is a development starter, not production-ready. Database migrations, production identity lifecycle, comprehensive authorization tests, and deployment hardening remain outstanding.

## Security requirements before production
- SSO/OIDC integration and corporate identity lifecycle provisioning
- Enforced authorization and company-level data isolation
- PostgreSQL Row-Level Security where appropriate
- Approval segregation of duties
- Immutable audit trail and retention policy
- Secrets management, attachment scanning, and security testing
- No banking passwords or credentials stored in ticket records

See the `docs/` directory for architecture, business process, API, and roadmap documentation.
