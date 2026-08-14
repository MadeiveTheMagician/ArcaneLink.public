# ArcaneLink

**Release candidate:** `1.0.0-rc.1`  
**Official website:** [arcane-link.ru](https://arcane-link.ru)  
**Repository status:** private academic-review source tree

[Русская версия](README.ru.md)

ArcaneLink is a centralized communication platform for communities. It
combines servers and spaces, direct and group conversations, files,
reactions, moderation, granular role permissions, and real-time voice, video,
and screen sharing in a single product.

This repository is a deployable release-candidate monorepo. It contains the
ASP.NET Core backend, PostgreSQL migrations, the React web client, desktop and
mobile wrappers, infrastructure definitions, automated tests, and operating
documentation. Runtime data, credentials, signing material, and production
secrets are intentionally not included.

## Repository layout

```text
backend/
  ArcaneLink/          ASP.NET Core API, SignalR and EF Core migrations
  ArcaneLink.Tests/    unit and integration tests
  tools/               repository-scoped backend utilities
frontend/
  client.web/          React and TypeScript application
  client.desktop/      Electron desktop wrapper
  client.mobile/       Capacitor Android wrapper
infrastructure/
  nginx/               reverse-proxy configuration
  scripts/             deployment and operations scripts
docs/                  project and operations documentation
```

## Main capabilities

- Accounts, sessions, user profiles, friends, direct messages and group chats.
- Community servers with categories, text spaces, voice spaces and companion
  text chats.
- Messages, edits, replies, reactions, mentions, attachments, pins, search and
  read state.
- Voice rooms with audio, camera and screen-sharing signaling over SignalR and
  WebRTC connectivity with STUN/TURN support.
- Server roles, granular permissions, protected resources, moderation,
  invitations, join requests, bans and audit records.
- Asset lifecycle controls, health endpoints, structured logging and a tested
  PostgreSQL migration chain.

## Technology

- .NET 10, ASP.NET Core, Entity Framework Core and SignalR
- PostgreSQL 17
- React 19, TypeScript 6 and Vite 8
- Electron and Capacitor Android wrappers for the centralized HTTPS service
- Nginx, Docker Compose and Coturn
- Playwright and xUnit-based automated tests

## Start here

1. Read [Development](DEVELOPMENT.md) for local prerequisites and verification.
2. Read [Configuration](CONFIGURATION.md) before creating environment files.
3. Read [Deployment](DEPLOYMENT.md) before running database migrations or a
   persistent environment.
4. Review [Security](SECURITY.md) before exposing an instance to a network.

The shortest container-based development path is:

```text
copy .env.local.example .env
docker compose up -d --build --wait
```

Replace the two placeholder secrets before startup. The migration service runs
before the backend. The detailed deployment guide is authoritative for the
official TLS environment and upgrades of persistent installations.

## Architecture and limits

ArcaneLink is designed as one centralized service deployment. The backend is
authoritative for identity, access control, signaling, messages and stored
data. The official production topology relays WebRTC through TURN with
short-lived credentials; local development may allow direct connectivity. The
current release does not include an SFU and therefore does not inspect or mix
media on the backend.
The reference topology uses one backend service and one PostgreSQL database;
multi-node high availability is not claimed for this release candidate.

See [Architecture](ARCHITECTURE.md) and [Release status](RELEASE_STATUS.md) for
the exact boundaries of `1.0.0-rc.1`.

## Documentation

- [Architecture](ARCHITECTURE.md)
- [Database and migrations](DATABASE.md)
- [Configuration](CONFIGURATION.md)
- [Development](DEVELOPMENT.md)
- [Testing](TESTING.md)
- [Deployment](DEPLOYMENT.md)
- [Security](SECURITY.md)
- [Privacy and runtime data](PRIVACY_AND_DATA.md)
- [Source asset policy](ASSET_POLICY.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)
- [License scope](LICENSE_SCOPE.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## License

This private review repository is **not open source**. It is provided under
the repository-root Academic Review License. Third-party dependencies remain
under their own licenses. Do not redistribute the source or deploy a public
copy without written authorization.
