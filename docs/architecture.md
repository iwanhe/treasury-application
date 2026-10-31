# Architecture baseline

React SPA -> NestJS modular monolith REST API -> PostgreSQL. Redis is reserved for background jobs.

Planned bounded modules:
- Identity & Access: SSO/OIDC, RBAC, company memberships
- Company Directory: legal entities and access scope
- Treasury Requests: ticket lifecycle and attachments
- Workflow: conditional approval, delegation, segregation of duties
- SLA & Notifications: due dates, email queue, escalation
- Financial Data: controlled per-company uploads and viewing
- Integrations: Oracle EBS, SAP, Oracle Database adapters
- Audit & Reporting: immutable history, dashboards, Excel export

Integration adapters must stay behind server-side interfaces. Start read-only, use timeouts, retries, idempotency keys, correlation IDs and reconciliation. Never expose ERP credentials to the browser.

Company scope must be derived from authenticated memberships on the server; never trust a company ID supplied by the client. Add PostgreSQL RLS as defense in depth before production.

This repository is a bootstrap only; authentication, authorization, approval engine, RLS and integrations are not yet implemented.
