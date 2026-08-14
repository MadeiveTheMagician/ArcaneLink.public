# Changelog

This file follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project uses Semantic Versioning.

## [1.0.0-rc.1] - 2026-08-11

### Added

- Centralized community servers, spaces, messaging and realtime presence.
- Voice rooms with WebRTC audio, video, screen sharing and TURN support.
- Versioned granular server permissions, role hierarchy and resource access.
- Invites, join requests, bans, moderation reports and audit events.
- Asset retention, optimized media variants and domain-safe deletion rules.
- Web, Electron desktop and Capacitor Android projects in one monorepo.
- PostgreSQL migration, backup, health-check and CI workflows.
- Authenticated short-lived TURN REST credentials for relay-only production
  voice without browser-bundled infrastructure secrets.

### Changed

- Repository reorganized into backend, frontend, infrastructure and docs.
- Runtime data, credentials and workstation-specific artifacts removed.
- Configuration converted to documented environment-based templates.

### Security

- Restricted governance realtime audiences to exact permissions.
- Added fail-closed granular authorization and hierarchy checks.
- Preserved sensitive files outside version control by default.

[1.0.0-rc.1]: https://arcane-link.ru
