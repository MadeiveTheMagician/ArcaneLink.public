# Release status: 1.0.0-rc.1

`1.0.0-rc.1` is the first repository-wide release candidate. The version means
that the intended 1.0 feature set and data model are present, while final
deployment rehearsal, signing, operational observation and review feedback may
still produce compatible fixes before `1.0.0`.

## Included

- deployable backend and PostgreSQL migration history;
- web client and automated browser/unit checks;
- Electron and Capacitor Android packaging projects;
- Docker Compose, Nginx and Coturn reference infrastructure;
- granular server and resource authorization;
- messaging, assets, moderation and realtime functionality;
- voice, video and screen-sharing signaling;
- sanitized examples and operating documentation.

## Release gates before 1.0.0

- reproduce a clean deployment from this repository and empty volumes;
- reproduce an upgrade from the last deployed database backup;
- verify backup and restore, not only backup creation;
- run backend, frontend, migration and browser suites in CI;
- rotate all environment credentials used before repository sanitization;
- sign desktop and Android release artifacts outside the repository;
- observe the candidate under realistic realtime and media load;
- record known limitations in the final release notes.

## Candidate verification snapshot

- backend Release build completed without warnings; 470 tests passed and four
  opt-in PostgreSQL migration tests were skipped outside their isolated
  database fixture;
- web lint, typecheck and production build passed, with 418 unit tests;
- an unsigned x64 NSIS installer was built and its packaged application/version
  inspected;
- Android debug and unsigned release APKs were built with JDK 21 and SDK 36;
- clean-container migration, readiness and web smoke checks passed;
- short-lived TURN credential backend/frontend contract tests passed, and the
  pinned Coturn image completed an authenticated allocation health probe.

## Known candidate limitations

- WebRTC media uses peer connections and the official topology requires TURN
  relay; no SFU is included.
- The official topology requires Coturn for voice and issues short-lived TURN
  REST credentials at runtime. Without the credential service, production
  voice intentionally fails closed rather than exposing direct candidates.
- The reference deployment is a single application node and PostgreSQL
  primary.
- Content Security Policy is enabled in report-only mode while the final policy
  is observed and tightened.
- Upload validation and retention are implemented, but an external malware
  scanner is not bundled.
- Desktop and Android outputs are unsigned until the controlled release job
  supplies external signing credentials.
- The packaged clients have not yet completed a signed installation and
  connected-device acceptance test.
- Android microphone and camera support depends on device WebView permission
  handling; screen sharing is not claimed until a MediaProjection flow is
  validated on supported Android versions.

## Versioning policy

ArcaneLink follows Semantic Versioning for repository releases:

- patch: compatible fixes and security hardening;
- minor: backward-compatible features;
- major: incompatible API, persistence or deployment contract changes.

Database migrations remain forward-only in normal operation. A release tag
identifies source, schema expectations and client build together.
