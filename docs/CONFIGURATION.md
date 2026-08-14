# Configuration

ArcaneLink uses checked-in examples and environment-specific secret files.
The repository contains no working production credentials.

## Environment files

- `.env.example` is the production template for `arcane-link.ru` and TLS.
- `.env.local.example` is the loopback-only local Docker template.
- `.env.turn.example` documents the mandatory Production Coturn relay and the
  runtime credential issuer.
- `.env` and `.env.turn` are local files and are ignored by Git.

For local review, copy `.env.local.example` to `.env`. For the official
deployment, copy `.env.example`. Replace every secret placeholder with a unique
value. Never send the resulting files through chat, issue trackers or build
artifacts.

## Required production values

At minimum, provide:

- `ConnectionStrings__DefaultConnection`: the selected database connection;
- `POSTGRES_PASSWORD`: a unique random database password;
- `JWT_SECRET`: at least 32 random bytes, stored as a secret;
- `ALLOWED_HOSTS`: only the deployed host names;
- `PUBLIC_ORIGIN`: the canonical HTTPS origin;
- `TURN_REALM`, `TURN_PUBLIC_HOST`, a routable public IPv4
  `TURN_EXTERNAL_IP`, and a random `TURN_SHARED_SECRET` of at least 32 bytes.

For a direct non-Compose backend launch, use the ASP.NET Core names
`JwtSettings__SecretKey`, `AllowedHosts` and `DataProtection__KeysPath`.

The reference host is `arcane-link.ru`. A review or staging environment should
use its own host name and its own credentials.

## Persistent paths

Three data classes must survive container replacement:

- PostgreSQL database files;
- user-uploaded assets and generated variants;
- ASP.NET Core data-protection keys.

They are mounted as volumes and must be included in the backup policy. Do not
bind them into a Git working tree.

## Container networks

The Compose topology uses separate default, edge and internal core networks.
Their CIDRs are controlled by `ARCANELINK_DEFAULT_SUBNET`,
`ARCANELINK_EDGE_SUBNET` and `ARCANELINK_CORE_SUBNET`. Select three distinct
ranges that do not overlap routes used by the host, LAN, WSL or VPN software.

`FORWARDED_HEADERS_KNOWN_NETWORK` must match the core subnet because Nginx
reaches the backend through that network. Existing Docker networks retain their
old CIDRs; after changing these values, recreate the project networks without
removing the named data volumes.

## WebRTC configuration

The official production path is relay-only. An authenticated client requests
temporary ICE configuration from `GET /api/voice/ice-servers`. The backend
creates a time-limited Coturn username and HMAC credential; the shared secret
never enters the browser bundle or API response. Credentials are cached only
in memory. Before creating a new peer allocation or restarting ICE near
expiry, the client requests a fresh lease; an established allocation is not
persisted by the application.

`TURN_CREDENTIAL_TTL_SECONDS` accepts 60 to 3600 seconds and defaults to 600.
The reference endpoint rate limit allows 12 credential requests per
authenticated ArcaneLink user per minute. Coturn separately limits concurrent
allocations with `TURN_USER_QUOTA` and `TURN_TOTAL_QUOTA`; the total quota must
fit within `TURN_MIN_PORT` through `TURN_MAX_PORT`. `TURN_MAX_BPS` limits one
session and `TURN_BPS_CAPACITY` limits the whole relay; both are bytes per
second. Private, link-local, loopback, documentation and multicast peers are
denied by the reference relay configuration, and anonymous STUN is disabled.

Production validation requires the issuer and Coturn configuration and fails
closed instead of falling back to direct peer candidates. Local development
may use direct connectivity only through the explicit development switch.

Relay-only transport prevents direct peer candidate use, but increases TURN
bandwidth and does not turn Coturn into an SFU.

## Secret rotation

Rotate a secret immediately if it was committed, copied into logs, attached to
an issue, or exposed to an unauthorized reviewer. Deleting a file from the
latest commit does not remove it from Git history.
