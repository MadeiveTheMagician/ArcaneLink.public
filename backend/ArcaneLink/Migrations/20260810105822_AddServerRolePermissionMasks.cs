using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddServerRolePermissionMasks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "permission_mask",
                table: "server_roles",
                type: "bytea",
                nullable: false,
                defaultValue: new byte[] { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 });

            migrationBuilder.AddColumn<int>(
                name: "permission_schema_version",
                table: "server_roles",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.Sql(
                """
                WITH legacy_permissions AS (
                    SELECT
                        "role_id",
                        BOOL_OR(
                            "permission_id" =
                                '24000000-0000-0000-0000-000000000201'::uuid AND
                            "is_granted") AS "manage_server",
                        BOOL_OR(
                            "permission_id" =
                                '24000000-0000-0000-0000-000000000202'::uuid AND
                            "is_granted") AS "manage_roles",
                        BOOL_OR(
                            "permission_id" =
                                '24000000-0000-0000-0000-000000000203'::uuid AND
                            "is_granted") AS "manage_invites",
                        BOOL_OR(
                            "permission_id" =
                                '24000000-0000-0000-0000-000000000204'::uuid AND
                            "is_granted") AS "manage_members",
                        BOOL_OR(
                            "permission_id" =
                                '24000000-0000-0000-0000-000000000205'::uuid AND
                            "is_granted") AS "view_audit_log",
                        BOOL_OR(
                            "permission_id" =
                                '24000000-0000-0000-0000-000000000210'::uuid AND
                            "is_granted") AS "manage_reports"
                    FROM "server_role_permissions"
                    GROUP BY "role_id"
                )
                UPDATE "server_roles" AS role
                SET "permission_mask" =
                    set_byte(
                        set_byte(
                            set_byte(
                                set_byte(
                                    decode(repeat('00', 32), 'hex'),
                                    2,
                                    CASE
                                        WHEN legacy."manage_members" THEN 158
                                        ELSE 0
                                    END),
                                3,
                                (CASE
                                    WHEN legacy."manage_members" THEN 7
                                    ELSE 0
                                 END) +
                                (CASE
                                    WHEN legacy."manage_roles" THEN 48
                                    ELSE 0
                                 END) +
                                (CASE
                                    WHEN legacy."manage_server" THEN 128
                                    ELSE 0
                                 END)),
                            5,
                            CASE
                                WHEN legacy."manage_invites" THEN 112
                                ELSE 0
                            END),
                        6,
                        (CASE
                            WHEN legacy."view_audit_log" THEN 2
                            ELSE 0
                         END) +
                        (CASE
                            WHEN legacy."manage_reports" THEN 4
                            ELSE 0
                         END))
                FROM legacy_permissions AS legacy
                WHERE role."id" = legacy."role_id";
                """);

            migrationBuilder.AddCheckConstraint(
                name: "CK_ServerRoles_PermissionMaskLength",
                table: "server_roles",
                sql: "length(\"permission_mask\") = 32");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ServerRoles_PermissionSchemaVersion",
                table: "server_roles",
                sql: "\"permission_schema_version\" = 1");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_ServerRoles_PermissionMaskLength",
                table: "server_roles");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ServerRoles_PermissionSchemaVersion",
                table: "server_roles");

            migrationBuilder.DropColumn(
                name: "permission_mask",
                table: "server_roles");

            migrationBuilder.DropColumn(
                name: "permission_schema_version",
                table: "server_roles");
        }
    }
}
