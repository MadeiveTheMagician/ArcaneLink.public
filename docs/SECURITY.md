# Security policy

## Supported version

Security fixes are developed against the latest ArcaneLink release candidate
or stable release. `1.0.1` is the supported review baseline until it is
replaced.

## Reporting a vulnerability

Do not open a public issue and do not include secrets, personal data or working
exploit payloads in an ordinary discussion. Use GitHub private vulnerability
reporting when it is enabled, or establish another private channel with the
repository owner before sending sensitive details. Include:

- affected version and component;
- minimal reproduction steps;
- expected impact;
- whether credentials or user data may have been exposed;
- a safe contact method for follow-up.

The maintainer will acknowledge the report, validate scope, prepare a fix and
coordinate disclosure when appropriate.

## Deployment baseline

- terminate external traffic with HTTPS;
- keep PostgreSQL and backend service ports private;
- use unique, random database and JWT secrets plus a dedicated TURN shared
  secret;
- persist and protect ASP.NET Core data-protection keys;
- restrict trusted proxy networks;
- run migrations from the dedicated tool image;
- back up the database, assets and keys before an upgrade;
- keep cleanup in dry-run mode until its effects are reviewed;
- never use production user data in tests or demonstrations.

## Repository hygiene

The following must never be committed:

- `.env` files containing active values;
- TLS certificates, private keys, Android keystores or desktop signing keys;
- database dumps, login lists or data-protection keys;
- runtime uploads, avatars, messages, logs or test recordings;
- generated build, package, coverage and browser-report directories.

If a secret reaches Git, rotate it first and then clean history. Merely adding
the path to `.gitignore` does not make the secret safe.

## Media boundary

Current voice/video media uses WebRTC peer connections. The official production
policy forces Coturn relay so peers do not exchange direct network candidates.
Authenticated clients receive short-lived HMAC-derived TURN credentials from
the backend; the Coturn shared secret remains server-side and must be rotated
and monitored like any other infrastructure secret.
The reference Coturn service disables anonymous STUN and TCP peer relays,
blocks private, loopback, link-local, documentation and multicast peer
destinations, and enforces positive per-user, total-allocation and bandwidth
ceilings. This prevents the relay from becoming an internal-network pivot and
bounds resource exhaustion; operators must tune the ceilings to the host.
The centralized backend authorizes rooms and signaling, but Coturn is not an
SFU and cannot provide server-side media inspection against a modified client.
