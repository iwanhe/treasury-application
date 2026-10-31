# Treasury Application

Enterprise Treasury Service Request and Financial Information Portal.

## Technology
- React + TypeScript + Vite + Ant Design
- NestJS modular monolith REST API
- PostgreSQL + Prisma ORM
- Redis for background jobs (planned)
- Docker Compose and GitHub Actions

## MVP scope
- Development authentication foundation
- Multi-company access model
- Treasury service request/ticket management
- Conditional approval workflow foundation
- Treasury dashboard foundation

Planned increments: SLA management, email notifications, financial data upload and viewing, Excel export, Oracle EBS integration, and SAP integration.

## Repository status
Initial project bootstrap. This is a development starter, not production-ready.

## Security requirements before production
- SSO/OIDC integration
- Enforced authorization and company-level data isolation
- PostgreSQL Row-Level Security where appropriate
- Approval segregation of duties
- Immutable audit trail and retention policy
- Secrets management, attachment scanning, and security testing
- No banking passwords or credentials stored in ticket records

See the `docs/` directory for architecture, business process, API, and roadmap documentation as these are added.
