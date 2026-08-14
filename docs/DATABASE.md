# Database and migrations

ArcaneLink uses PostgreSQL 17 through Entity Framework Core. The release
candidate contains 59 forward migrations, from the initial schema through the
granular role-mask and default-permission backfills.

## Why the history is retained

Migration source is part of the deployable product. It supports:

- creating an empty review or production database;
- upgrading an existing installation in the correct order;
- reviewing when and why persisted contracts changed;
- testing data backfills and relational security constraints.

Squashing the history would require a separately verified baseline migration
and an adoption path for every already deployed database. Version 1.0 keeps the
complete history instead.

## Normal workflow

1. Change the EF model and service write paths together.
2. Add a new migration; never edit one already deployed.
3. Inspect generated SQL and security-sensitive backfills.
4. Run `has-pending-model-changes`.
5. Test clean creation and upgrade from the previous release.
6. Back up the target database and validate the backup.
7. Stop an old application version if it cannot write the new schema.
8. Apply the migration with the dedicated migration image.
9. Verify migration history and application readiness.

## Security-sensitive changes

Authorization migrations use explicit scope checks and fail when legacy rows
cannot be mapped safely. Do not replace these failures with silent deletion,
cross-server reassignment or permissive defaults.

## Rollback

Production rollback normally restores a verified pre-deployment backup and the
matching application release. Down migrations are development tools, not a
guaranteed preservation mechanism after new-version writes have occurred.

See [Deployment](DEPLOYMENT.md) and [Testing](TESTING.md) for the operational
commands and gates.

