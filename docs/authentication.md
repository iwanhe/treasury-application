# Authentication, provisioning, and authorization

## Identity provider

The local development identity provider is Keycloak. The application uses standard OIDC access tokens so Microsoft Entra ID can be considered later without coupling application authorization to Keycloak APIs.

The API verifies token signature using remote JWKS, exact issuer and audience, expiration (via jose), and an explicit algorithm allow-list (RS256/ES256). It does not accept unsigned tokens or decode-only JWTs.

## Identity mapping

The JWT `sub` must match `User.externalId`. Provision users through a controlled administrator or identity-sync process before allowing API access. Unknown and inactive users are denied. Email is not used as the immutable identity key.

## Source of authorization truth

Keycloak authenticates the identity. PostgreSQL is authoritative for application authorization:
- `UserCompanyRole` assigns roles to a user within a specific company/PT.
- `Role` defines application role codes.
- A Keycloak realm role by itself does not grant Treasury application access.
- The API currently reads realm roles into the principal for diagnostics/compatibility only; company access and privileged actions must be checked against database memberships.

Initial role catalog:
- `REQUESTER`: create, submit, cancel, and track own service requests.
- `TREASURY_MAKER`: access company Treasury tickets and prepare processing (assignment and processing actions are next increments).
- `TREASURY_CHECKER`: view company Treasury tickets and perform checking in a later workflow increment.
- `APPROVER`: view company Treasury tickets; approval actions will be implemented with conditional approval rules.
- `ADMIN`: manage users and role assignments within an authorized company.

## Company-scoped administration API

All endpoints require a valid OIDC bearer access token.

- `GET /companies/mine`: returns active company memberships and the user's roles in each company.
- `GET /companies/:companyId/users`: requires `ADMIN` membership in that company.
- `POST /companies/:companyId/users`: requires `ADMIN` membership in that company and provisions/updates an application user plus the requested roles for that company.

Provisioning request example:

```json
{
  "externalId": "<Keycloak user sub>",
  "email": "user@example.com",
  "fullName": "Treasury User",
  "roles": ["REQUESTER", "APPROVER"]
}
```

The API validates the payload, rejects unknown role codes and prevents an email from being silently attached to a different identity. Provisioning does not create a Keycloak account or password; the identity must already exist in Keycloak. The same identity can have memberships in multiple PTs, each with a different role set.

## Initial administrator bootstrap

The demo seed creates a development-only application admin and memberships in two demo companies, but does not know the Keycloak `sub`. Before using protected endpoints:
1. Start Keycloak and sign in as the imported development user.
2. Obtain the user's `sub` from the verified access token.
3. Set `User.externalId` for `treasury.admin@example.test` to that exact subject in the development database.
4. Ensure the user is active and seeded ADMIN memberships exist.

Do not accept an arbitrary subject from an unauthenticated request. This initial mapping is a one-time local bootstrap step.

## Company isolation contract

For every company-owned resource, backend services must call `CompanyAccessService.assertMembership` and constrain the actual data query by the authorized company ID. Never trust a company ID, role, or user ID supplied by the browser without server-side authorization. The current company admin endpoints use a database-backed company role guard.


## Treasury ticket API foundation

All endpoints require a valid OIDC bearer access token and an active role membership in the route's company.

- `GET /companies/:companyId/tickets?status=SUBMITTED&limit=20`: list tickets. A requester sees only their own tickets; Treasury Maker, Treasury Checker, Approver, and Admin can see company tickets.
- `POST /companies/:companyId/tickets`: create a draft. Allowed roles: Requester, Treasury Maker, Admin.
- `GET /companies/:companyId/tickets/:ticketId`: view ticket detail, with the same requester-versus-Treasury visibility rule.
- `PATCH /companies/:companyId/tickets/:ticketId`: edit own draft only.
- `POST /companies/:companyId/tickets/:ticketId/submit`: submit own draft.
- `POST /companies/:companyId/tickets/:ticketId/cancel`: cancel own draft or submitted ticket.

Ticket numbers use the format `TR-{COMPANY_CODE}-{YEAR}-{SEQUENCE}`, with a transactionally incremented company/year counter. Ticket creation, edits, submission, and cancellation write audit events in the same database transaction as the business change. Company ID is always included in ticket lookups; a ticket from another company is returned as not found.

Initial lifecycle implemented:
- `DRAFT -> SUBMITTED`
- `DRAFT -> CANCELLED`
- `SUBMITTED -> CANCELLED`

Editing is allowed only while DRAFT. Approval, rejection, return, assignment, processing, and completion transitions are deliberately not exposed until the conditional approval and segregation-of-duties rules are implemented.

Database note: the new migration creates the ticket counter table. The repository still needs a complete baseline migration for the existing schema before a clean database can be provisioned solely with `prisma migrate deploy`; validate migration history against the intended target database before deployment.

## Security boundaries / production work still required

- Add audit events for user and membership administration, including actor, company, and role changes.
- Add authorization tests for invalid signature, wrong issuer/audience, expired token, unknown/inactive user, cross-company admin access, and privilege escalation.
- Add operation-level policy for ticket assignment, checking, approval and segregation of duties.
- Add controlled user deactivation and role revocation workflows; current provisioning adds roles and does not remove existing memberships.
- Configure HTTPS, CORS allow-list, rate limits, security headers and secret management.
- Confirm provider access-token format and audience; do not use an ID token as an API bearer token.
- Use a restricted DB account; keep migration credentials separate.
- No local password login, refresh-token storage or token issuance is implemented here.
