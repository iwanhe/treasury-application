# Treasury Web

React + TypeScript + Vite + Ant Design frontend.

## Local setup
1. Copy `.env.example` to `.env.local`.
2. Set the API base URL (include `/api` when using the Nest global prefix), Keycloak URL, realm, and public client ID.
3. Register `http://localhost:5173/*` as a valid redirect URI and web origin for the `treasury-web` Keycloak client.
4. Start PostgreSQL, Redis, and Keycloak; start the API and then run `pnpm --filter @treasury/web dev`.

The frontend uses Keycloak Authorization Code Flow with PKCE S256. Access tokens are kept by the Keycloak JS adapter in memory and refreshed before expiry; no token is written to local storage by this application.

## Approval rule administration
The current screen lists active company-specific and global fallback rules, lets company ADMIN users create/update/deactivate company rules, and provides a client-side preview of the matching sequential approval path. Global rules are read-only in the company context. The preview is informational; the API remains authoritative when a ticket is submitted.