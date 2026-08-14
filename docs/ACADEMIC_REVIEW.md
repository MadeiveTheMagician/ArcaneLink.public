# Academic review guide

This repository is prepared so an examiner can inspect architecture, build the
code, run automated checks and deploy an isolated instance without receiving
the author's local environment or user data.

## Suggested review order

1. [Release status](RELEASE_STATUS.md)
2. [Architecture](ARCHITECTURE.md)
3. backend controllers, services and authorization runtime
4. EF Core migrations and migration tests
5. web feature structure and realtime/media hooks
6. automated test suites and CI workflow
7. [Security](SECURITY.md) and [Deployment](DEPLOYMENT.md)

## Reproducibility

The repository pins the .NET SDK, Node engine and package lockfiles. Example
configuration contains placeholders only. A reviewer should create an isolated
PostgreSQL database and synthetic accounts.

## Scope statement

ArcaneLink is presented as a centralized communication service and a complete
engineering project. The release candidate includes server, web, packaging
clients, authorization, realtime communication, persistence, operations and
tests. It does not claim multi-node high availability or an SFU in version 1.0.

## Integrity of the review copy

The review tree is a curated clean source snapshot, not a copy of the author's
working Git history. This prevents accidental disclosure of local credentials,
runtime user content and unrelated development artifacts. Functional source,
migrations and tests are retained.

