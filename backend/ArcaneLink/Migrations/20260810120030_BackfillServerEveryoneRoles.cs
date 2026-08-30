using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class BackfillServerEveryoneRoles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM "server_roles"
                        WHERE "deleted_at" IS NULL
                        GROUP BY "server_id"
                        HAVING COUNT(*) FILTER (WHERE "kind" = 'everyone') > 1
                    ) THEN
                        RAISE EXCEPTION 'A server has more than one active everyone role.';
                    END IF;

                    IF EXISTS (
                        SELECT 1
                        FROM "servers" AS server
                        JOIN "server_roles" AS role
                          ON role."server_id" = server."id"
                         AND role."deleted_at" IS NULL
                         AND (role."code" = 'everyone' OR role."title" = '@everyone')
                        WHERE server."deleted_at" IS NULL
                          AND role."kind" <> 'everyone'
                    ) THEN
                        RAISE EXCEPTION 'The reserved everyone role code or title is already in use.';
                    END IF;
                END $$;

                INSERT INTO "server_roles" (
                    "id",
                    "server_id",
                    "code",
                    "title",
                    "description",
                    "kind",
                    "mentionable",
                    "level",
                    "is_system",
                    "permission_mask",
                    "permission_schema_version",
                    "version",
                    "created_at",
                    "updated_at")
                SELECT
                    gen_random_uuid(),
                    server."id",
                    'everyone',
                    '@everyone',
                    'Default permissions for every active server member',
                    'everyone',
                    FALSE,
                    2147483647,
                    TRUE,
                    decode('ffe721' || repeat('00', 29), 'hex'),
                    1,
                    gen_random_uuid(),
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                FROM "servers" AS server
                WHERE server."deleted_at" IS NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM "server_roles" AS role
                      WHERE role."server_id" = server."id"
                        AND role."kind" = 'everyone'
                        AND role."deleted_at" IS NULL
                  );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DELETE FROM "server_roles"
                WHERE "kind" = 'everyone'
                  AND "code" = 'everyone'
                  AND "is_system" = TRUE
                  AND "created_by_user_id" IS NULL;
                """);
        }
    }
}
