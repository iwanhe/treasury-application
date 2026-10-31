# Keycloak local development

## Scope

This setup provides a local OIDC provider for development and API integration tests. It is not a production deployment. Keycloak imports the `treasury-dev` realm from `docker/keycloak/treasury-dev-realm.json`.

## Start services

```bash
docker compose up -d postgres redis keycloak
```

Open Keycloak at http://localhost:8080 (bootstrap admin: `admin` / `admin`). Select realm `treasury-dev`.

The imported development user is:
- Username: `treasury.admin`
- Temporary password: `ChangeMe123!`
- The user must change this password at first login.

**Development only:** these credentials are intentionally predictable. Never reuse them outside a local environment or expose this Keycloak instance publicly.

## OIDC clients

- `treasury-web`: public browser client, Authorization Code flow, PKCE S256, redirect URI `http://localhost:5173/*`.
- `treasury-api`: API audience identifier. It is not a browser login client.
- `treasury-api-audience`: default client scope that adds `treasury-api` to access-token audience.

The API validates the access token signature against the realm JWKS, exact issuer, audience `treasury-api`, expiration, and an explicit RS256/ES256 algorithm allow-list.

## API environment

Use these values in the API environment:

```dotenv
OIDC_ISSUER=http://localhost:8080/realms/treasury-dev
OIDC_AUDIENCE=treasury-api
OIDC_JWKS_URI=http://localhost:8080/realms/treasury-dev/protocol/openid-connect/certs
```

Run NestJS on the host for this local setup. If the API later runs in Docker, ensure the token's issuer exactly matches the configured issuer; do not mix `localhost` and `keycloak` hostnames.

## Map the Keycloak identity to the application user

The API deliberately does not auto-create users. Obtain the Keycloak user's immutable subject (`sub`) from a verified access token or the Keycloak admin console, then set that value as `User.externalId` for the matching application user. Keep email as a contact attribute, not the identity key.

The development realm's demo account is not automatically provisioned in PostgreSQL. Create the corresponding Treasury user and company memberships through the controlled seed/admin process before calling protected endpoints.

## Smoke test

1. Complete the temporary password change by signing into the realm account through the web client.
2. Request an access token through Authorization Code + PKCE from `treasury-web`; do not use an ID token as the API bearer token.
3. Confirm the access token contains audience `treasury-api` and issuer `http://localhost:8080/realms/treasury-dev`.
4. Provision its `sub` as `User.externalId` and ensure the application user status is `ACTIVE`.
5. Call `GET http://localhost:3000/companies/mine` with `Authorization: Bearer <access_token>`.

## Production hardening

Use a supported production Keycloak deployment with TLS, durable PostgreSQL storage, backups, restricted admin access, secret management, monitoring, and a non-development realm configuration. Replace bootstrap credentials, remove demo users, define redirect URI allow-lists, configure logout/session policies, and test key rotation and JWKS cache behavior. Configure MFA and corporate lifecycle provisioning according to company policy.

Microsoft Entra ID remains a future OIDC provider option; the application should continue to depend on issuer/audience/JWKS configuration rather than Keycloak-specific APIs.
