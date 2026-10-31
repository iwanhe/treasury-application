# Authentication and authorization foundation

## OIDC configuration

Set these API environment variables from the chosen identity provider:
- `OIDC_ISSUER`: exact issuer URL from provider metadata.
- `OIDC_AUDIENCE`: API audience/client identifier expected in access tokens.
- `OIDC_JWKS_URI`: provider JWKS endpoint.

The API verifies signature using remote JWKS, exact issuer and audience, expiration (via jose), and an explicit algorithm allow-list (RS256/ES256). It does not accept unsigned tokens or decode-only JWTs.

## Identity provisioning

The JWT `sub` must match `User.externalId`. Provision users through a controlled administrator or identity-sync process before allowing API access. Unknown and inactive users are denied. Email is not used as the immutable identity key.

## Company authorization

`GET /companies/mine` requires a valid bearer token and returns active company memberships for the mapped internal user. For every company-owned resource, backend services must call CompanyAccessService and constrain the actual data query by authorized company ID.

## Security boundaries / production work still required

- Configure HTTPS, CORS allow-list, rate limits, security headers and secret management at deployment.
- Confirm the provider's access-token format and audience; do not use an ID token as an API bearer token.
- Add authorization tests for invalid signature, wrong issuer/audience, expired token, unknown/inactive user and cross-company access.
- Add role/permission policy enforcement for individual operations. Membership lookup is not a substitute for operation-level authorization.
- Use a restricted DB account; keep migration credentials separate.
- No local password login, refresh-token storage or token issuance is implemented here.
