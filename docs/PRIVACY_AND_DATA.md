# Privacy and runtime data

This source repository contains no real accounts, messages, uploads, tokens,
database dumps or device credentials. Review environments must preserve that
boundary.

## Runtime data classes

- PostgreSQL: accounts, memberships, messages, authorization and audit data;
- asset storage: user uploads and generated variants;
- data-protection keys: cryptographic material required to read protected
  application state;
- operational logs: identifiers and diagnostic context subject to retention;
- Coturn logs and metrics: connection metadata, not decrypted WebRTC media.

## Review and demo environments

Use synthetic names, generated avatars and non-sensitive attachments. Reset or
destroy demo data after the review retention period. Never restore a production
dump into a laptop or public CI runner.

## Logging

Do not log access or refresh tokens, TURN shared secrets or issued credentials,
message bodies, upload
content or raw authentication headers. Limit identifiers to what an operator
needs for diagnosis and control access to log storage.

## Backups

Backups inherit the sensitivity of the live system. Encrypt them, limit access,
record retention and deletion, and test restoration in an isolated network.
Deleting live data does not automatically remove historical backup copies.

## Repository examples

Example credentials use reserved or clearly non-production values. Reserved IP
addresses such as `203.0.113.0/24` are documentation placeholders and must be
replaced during deployment.
