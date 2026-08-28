# Contributing

This is a publicly visible, source-available academic-review repository, not
an open-source contribution project. Contributions require explicit
authorization from the repository owner.

## Workflow

1. Open or agree on a narrowly scoped change.
2. Create a short-lived branch.
3. Preserve public contracts or document intentional compatibility changes.
4. Add or update automated tests.
5. Run the checks in [Testing](TESTING.md).
6. Review the diff for secrets, personal data and generated files.
7. Submit the change for review with its migration and deployment impact.

## Database changes

Never rewrite an already deployed migration. Add a forward migration, include
fail-closed validation for security-sensitive backfills, and test both clean
creation and upgrade from the previous release. State whether an older backend
can safely run against the new schema.

## Authorization changes

Treat client capability checks as presentation only. Every protected operation
must have an authoritative backend decision, exact permission requirement,
server/resource scope and hierarchy test where applicable.

## Generated and private content

Do not commit package caches, builds, browser reports, logs, recordings,
uploads, dumps, secrets or workstation-specific settings. Use the repository
examples and synthetic fixtures.

By contributing, you confirm that you have the right to submit the change and
that it can be used under the repository's existing license terms.

