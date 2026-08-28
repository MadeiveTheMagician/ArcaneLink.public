# Development

Run all commands from the repository root unless a section says otherwise.

## Prerequisites

- .NET SDK `10.0.400` (pinned by `global.json`)
- Node.js 24 and npm 11
- Docker Desktop or Docker Engine with Compose v2
- PostgreSQL 17, either local or through Compose
- Git
- optional: Android Studio with a compatible JDK for the mobile wrapper

Do not reuse production credentials or a production database for development.

For the container-based local environment, copy `.env.local.example` to `.env`,
replace its password and JWT placeholders, and run
`docker compose up -d --build --wait`.

## Backend

Restore the repository-scoped .NET tools and dependencies:

```text
dotnet tool restore
dotnet restore ArcaneLink.slnx
dotnet build ArcaneLink.slnx
```

Provide `ConnectionStrings__DefaultConnection` and a development-only
`JwtSettings__SecretKey` through environment variables, then start the API:

```text
dotnet run --project backend/ArcaneLink/ArcaneLink.csproj
```

Apply migrations only to a database you have explicitly selected:

```text
dotnet ef database update \
  --project backend/ArcaneLink/ArcaneLink.csproj \
  --startup-project backend/ArcaneLink/ArcaneLink.csproj
```

Before running this command, print or otherwise verify the selected database
name and host. Migration commands are not a substitute for a backup.

## Web client

```text
cd frontend/client.web
npm ci
npm run dev
```

The development proxy routes API and realtime requests to the local backend.
Production builds require the authenticated relay configuration endpoint. To
test voice without Coturn during local Vite development only, set
`VITE_VOICE_DEV_ALLOW_STUN_FALLBACK=true` before starting the dev server.
See the Vite configuration if a different backend address is required.

## Desktop client

The desktop project is a wrapper around the configured ArcaneLink web origin:

```text
cd frontend/client.desktop
npm ci
npm run dev
```

Packaging commands create unsigned artifacts. Signing certificates and update
credentials must be supplied by a controlled release environment and must
never be committed.

## Mobile client

The production wrapper targets the official centralized HTTPS origin. Follow
`frontend/client.mobile/README.md` to set a development origin, synchronize
fallback web assets and open the Android project in Android Studio.

A standalone local web origin is not equivalent to production: ArcaneLink uses
same-origin API, realtime, asset and secure cookie contracts. Do not weaken
cookie or CORS policy merely to make an embedded local origin bypass them.

`local.properties`, signing keystores, service credentials and store metadata
are intentionally excluded from Git.

## Development data

Use generated demo accounts and synthetic uploads only. Runtime files live in
ignored directories or Docker volumes. Never copy production uploads,
database dumps, data-protection keys or authentication tokens into the source
tree.

The optional `backend/tools/TestDataSeeder` has no fallback credentials. It
requires `ConnectionStrings__DefaultConnection`, `ARCANELINK_SEED_MAIN_PASSWORD`
and `ARCANELINK_SEED_USER_PASSWORD`. Optional output locations are controlled
by `ARCANELINK_SEED_STORAGE_PATH` and `ARCANELINK_SEED_OUTPUT_PATH`.
