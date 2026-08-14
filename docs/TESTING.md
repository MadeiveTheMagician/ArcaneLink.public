# Testing

The repository uses backend unit/integration tests, browser-based frontend
unit tests, mocked end-to-end scenarios, real API smoke tests and opt-in
PostgreSQL migration tests.

## Backend

```text
dotnet build ArcaneLink.slnx -c Release
dotnet test backend/ArcaneLink.Tests/ArcaneLink.Tests.csproj \
  -c Release --no-build
```

PostgreSQL-specific tests require an isolated disposable database and the
environment switches documented in the CI workflow. They must never target a
shared development or production database.

The deployment script builds the containerized quality-gate images and then
runs the checks as ephemeral services. Running the commands in fresh
containers, rather than treating cached image layers as new test results,
guarantees that frontend and backend tests execute on every deployment:

```text
docker compose --profile tools build frontend-tests backend-tests
docker compose --profile tools run --rm --no-deps frontend-tests \
  sh -euc 'npm run lint; npm run test:unit; npm run build'
docker compose --profile tools run --rm --no-deps backend-tests \
  dotnet test backend/ArcaneLink.Tests/ArcaneLink.Tests.csproj \
    --configuration Release --no-build --no-restore \
    --filter 'FullyQualifiedName!~ArcaneLink.Tests.PostgreSql' \
    --logger 'console;verbosity=detailed'
docker compose --profile tools build migrations
docker compose --profile tools run --rm --no-deps migrations \
  migrations has-pending-model-changes \
    --project backend/ArcaneLink/ArcaneLink.csproj \
    --startup-project backend/ArcaneLink/ArcaneLink.csproj \
    --configuration Release --no-build
```

The production gate deliberately excludes mocked/real browser E2E and
PostgreSQL migration-apply tests. Those suites require browser binaries or an
isolated disposable database and remain mandatory CI jobs; they must never run
against the production database.

The deployment script's `--check-only` mode intentionally stops after the
configuration and host-port preflight. It permits the matching services of the
same Compose project, but rejects other containers that already own required
HTTP, HTTPS, PostgreSQL or TURN ports. Use a full guarded deployment, or run
the commands above directly, when a fresh local quality-gate result is required.

Check that every model change has a migration:

```text
dotnet ef migrations has-pending-model-changes \
  --project backend/ArcaneLink/ArcaneLink.csproj \
  --startup-project backend/ArcaneLink/ArcaneLink.csproj \
  --configuration Release --no-build
```

## Web client

```text
cd frontend/client.web
npm ci
npm run lint
npm run test:unit
npm run build
npm run test:e2e:mock
```

Real end-to-end tests require an isolated backend and database. The environment
must opt in explicitly; the CI workflow is the reference orchestration.

## Client packaging

Desktop and Android packages are wrappers around the centralized HTTPS service.
Unsigned review packages can be reproduced with:

```text
cd frontend/client.desktop
npm ci
npm run check
npm run dist:win

cd ../client.mobile
npm ci
npm run android:sync
android/gradlew :app:assembleDebug :app:assembleRelease
```

The Windows installer and Android release APK remain unsigned until a
controlled release environment supplies the external signing identities.
Never add keystores, certificates or signing passwords to this repository.
Android `versionCode=1` identifies this first review candidate; increment the
code for every distributed APK or AAB. The next distributed Android artifact
must use at least `versionCode=2`, even if the display version changes only
from RC to stable.

## Release verification

A release candidate is not accepted on build success alone. Verify:

1. a clean database migrates to the latest schema;
2. an upgrade copy of the previous database migrates without data loss;
3. backup restoration succeeds;
4. the web application loads through the reverse proxy;
5. health, authentication and realtime smoke tests pass;
6. a two-client voice/video test succeeds through the intended ICE policy;
7. desktop and Android packages build from a clean dependency install;
8. no secrets, user data or build outputs are present in the source tree.
