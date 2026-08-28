# Release status: 1.0.1

`1.0.1` is the current repository-wide source baseline. It combines the
sanitized public topology with the current backend, web, desktop and Android
implementation.

## Included

- ASP.NET Core API, SignalR hub and complete PostgreSQL migration history;
- account registration, verified email, password recovery and session control;
- servers, spaces, private conversations, messaging, moderation and assets;
- WebRTC signaling with short-lived TURN credentials and relay-only production
  policy;
- React web client, Electron desktop wrapper and Capacitor Android wrapper;
- Docker Compose, Nginx and Coturn reference infrastructure;
- automated backend, frontend, migration and browser test projects;
- sanitized environment templates and bilingual API ownership documentation.

## Current boundaries

- WebRTC uses peer connections; no SFU or server-side media mixing is included.
- The reference topology contains one backend node and one PostgreSQL primary.
- Production requires external TLS certificates, SMTP delivery, TURN routing,
  signing identities and independently managed secrets.
- Upload retention is included; an external malware scanner is not bundled.
- Desktop and Android release artifacts remain unsigned until a controlled
  release job supplies external signing credentials.

## Local verification snapshot (2026-08-26)

- .NET SDK `10.0.400` Release build: 0 warnings, 0 errors;
- backend tests: 511 passed, 4 isolated PostgreSQL migration tests skipped;
- web lint, typecheck and Vite production build: passed;
- frontend unit tests: 554 passed;
- base plus TURN Docker Compose configuration: valid;
- release-tree secret, authorship, local-path and generated-artifact checks:
  passed.

Container deployment, PostgreSQL migration fixtures, browser E2E suites and
signed client packages remain environment-specific release gates.

## Required release gates

1. Deploy from an empty database and migrate a restored production-like backup.
2. Run backend, frontend, migration and browser suites in the target CI image.
3. Exercise SMTP verification, password reset and email-change flows end to end.
4. Validate authenticated TURN allocation and representative media sessions.
5. Sign and install desktop and Android artifacts outside the repository.
6. Review configuration, logs, backups and retained uploads before exposure.

## Versioning policy

ArcaneLink follows Semantic Versioning. Database migrations are forward-only
in normal operation; a release identifies source, schema expectations and
client packages together.
