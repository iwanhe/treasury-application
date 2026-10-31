# Database foundation

## Core entities
- Company: legal entity / PT.
- User: enterprise identity record; authentication is delegated to SSO/OIDC in the target design.
- Role: application role catalogue.
- UserCompanyRole: explicit user-role membership scoped to one company.
- TreasuryTicket: request header with company, requester, assignee, type, status and SLA dates.
- ApprovalRule / TicketApproval: configured approval steps and ticket-specific decisions.
- TicketAttachment: metadata only; file bytes live in private object storage.
- AuditLog: append-oriented record of business and security events.

## Multi-company access rule
A user can access a company only through an active membership represented by UserCompanyRole and a permitted role. Every list/detail/update query must include the authorized company scope derived from the authenticated principal. Never accept company scope as authorization merely because the client supplied a companyId.

## Important implementation notes
1. Add company membership status and role permissions before enabling production access.
2. Add PostgreSQL Row-Level Security (RLS) as defense in depth. Set the company context transaction-locally on each request and ensure pooled connections cannot leak context.
3. Enforce segregation of duties: requester must not approve their own ticket unless a formally approved exception policy exists.
4. Treat audit logs as append-only; restrict UPDATE/DELETE at the database role level and define retention.
5. Store attachment bytes outside PostgreSQL. Validate file size/type, scan malware, and use opaque storage keys.
6. Do not store internet banking passwords, private keys, OTPs, or other banking credentials in tickets or attachments.
7. This is an initial schema, not a final regulatory data model. Review retention, privacy, and audit requirements with Security, Finance and Legal.
