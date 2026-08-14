# Deployment

This guide describes the reference single-node topology. It is appropriate for
controlled review and a centralized ArcaneLink service. It is not a claim of
multi-region or active-active availability.

## 1. Prepare the host

- install Docker Engine, Compose v2 and OpenSSL;
- configure DNS for the deployment host;
- obtain TLS certificates outside the repository;
- restrict database and backend ports to the private container network;
- provide enough persistent storage for PostgreSQL, uploads, keys and backups.

## 2. Configure secrets

Copy `.env.example` to `.env` and `.env.turn.example` to `.env.turn`. Replace
all placeholders. Restrict both files to the deployment account. Validate the
complete model without printing the resolved shared secret:

```text
bash ./infrastructure/scripts/deploy-wsl.sh --check-only --with-turn
```

`--check-only` validates configuration and prerequisites without building
images or running tests. The quality gates run during the full guarded
deployment shown below. It also fails early if another Docker Compose project
already owns the configured HTTP, HTTPS, PostgreSQL or TURN host ports; two
production stacks cannot publish the same ports concurrently.

For the direct HTTPS topology, the preflight also requires readable
`fullchain.pem` and `privkey.pem` files below `TLS_CERTIFICATES_DIR`. Obtain or
renew the certificate before starting the application containers.

Keep `COMPOSE_PROJECT_NAME` stable after the first deployment. Docker Compose
uses it when naming persistent volumes; changing it selects a different
PostgreSQL volume instead of renaming the existing deployment.

For manual validation, use the same two Compose files and both environment
files with `config --quiet`; never capture ordinary `docker compose config`
output in a log because it contains resolved environment values.

## 3. Build and verify

Run the repository quality gates or the equivalent CI workflow. Build the web
client and container images from the exact release candidate source.

## 4. Back up an existing deployment

Before applying migrations, create and validate:

- a PostgreSQL custom-format dump;
- a copy or snapshot of the asset volume;
- a protected copy of the data-protection key volume;
- a manifest with sizes, timestamps and hashes.

Test restore procedures periodically. A backup that has never been restored is
not a verified recovery point.

## 5. Apply migrations

Stop or drain the old backend when a migration introduces a schema contract it
cannot write. Run the dedicated migration image against the explicitly checked
database:

```text
docker compose \
  --env-file .env \
  --env-file .env.turn \
  -f docker-compose.yml \
  -f docker-compose.turn.yml \
  run --rm migrations
```

Migrations are normally forward-only. Restore the verified backup if a release
must be rolled back across an incompatible schema change.

## 6. Start the service

Use the guarded deployment path for a production host. It performs the
preflight, backup, fresh frontend and backend test runs, application image
build, EF model validation, Nginx validation, migrations and final HTTPS
readiness check in that order. Test output is streamed directly to the
terminal and is not accepted from a cached Docker build layer:

```text
bash ./infrastructure/scripts/deploy-wsl.sh --with-turn
```

The script deploys the checked-out source and never updates it automatically.
Fetch and select the intended release explicitly before running the preflight
and deployment, so the validated source is exactly the source being deployed.

For manual troubleshooting only, the raw Compose startup below bypasses the
script's backup, test, Nginx validation and final HTTPS readiness gates:

```text
docker compose --env-file .env --env-file .env.turn \
  -f docker-compose.yml -f docker-compose.turn.yml \
  up -d --build --wait
```

The official production topology includes Coturn. The override enables both
Coturn shared-secret authentication and the backend endpoint that issues
short-lived client credentials. Production startup and the deployment script
both reject a missing TURN issuer. `--without-turn` is available only for
non-Production development. Use the scripts under `infrastructure/scripts`
only after reviewing their environment gates and paths for the target host.

## 7. Post-deployment checks

- the database migration list contains no pending release migrations;
- readiness and liveness endpoints return success;
- the canonical HTTPS origin loads the current web build;
- login, message send, upload and realtime updates work;
- the `turn` and `backend` containers are healthy; Coturn container health
  checks its local TCP listener without consuming relay allocations, while
  authentication and public reachability are tested separately;
- an authenticated ICE request returns `Cache-Control: no-store`, only
  `turn:`/`turns:` URLs, `iceTransportPolicy=relay` and a future expiry; do not
  save or log its credential-bearing response body;
- two clients on different external networks establish bidirectional media,
  and WebRTC diagnostics show a relay candidate rather than a host or server
  reflexive candidate;
- DNS, `TURN_EXTERNAL_IP`, TCP/UDP 3478 and the configured UDP relay-port range
  are reachable through the production firewall and NAT;
- logs contain no secrets, stack traces with credentials or user payloads;
- backup and monitoring jobs are active.

## Updating the service

Treat backend, web build and schema as one release. Do not leave an older
backend writing to a schema that requires new fields, and do not deploy a web
client that assumes API contracts unavailable on the running backend.
