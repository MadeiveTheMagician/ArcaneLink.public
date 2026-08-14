# ArcaneLink Web client

This package is the canonical React and TypeScript source for every ArcaneLink client surface.
The desktop and Android projects are wrappers; they do not contain a second copy of the React application.

## Requirements

- Node.js 24 or newer;
- npm 11 or newer;
- a running ArcaneLink backend for interactive development.

## Development

From this directory:

```powershell
npm.cmd ci
npm.cmd run dev
```

Vite proxies `/api`, `/hubs`, and `/ping` to `http://localhost:5207` by default. Override the target when needed:

```powershell
$env:ARCANELINK_API_TARGET = 'http://127.0.0.1:5207'
npm.cmd run dev
```

### Voice transport in local development

The client requests short-lived TURN credentials from the authenticated
`GET /api/voice/ice-servers` endpoint at runtime. Credentials are kept only in
memory, are refreshed before expiration, and are never read from a Vite
environment variable or browser storage. Production builds require a valid
relay response and refuse to start voice if the endpoint is unavailable.

When testing the web UI without a configured TURN service, a direct/STUN
fallback can be enabled explicitly for local Vite development only:

```powershell
$env:VITE_VOICE_DEV_ALLOW_STUN_FALLBACK = 'true'
npm.cmd run dev
```

Do not enable this fallback when testing the production deployment model.

From the repository root, the backend can be started with:

```powershell
dotnet run --project .\backend\ArcaneLink\ArcaneLink.csproj
```

## Verification

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:unit
npm.cmd run build
```

The production build is written to `dist/`. It is generated output and must not be committed.
