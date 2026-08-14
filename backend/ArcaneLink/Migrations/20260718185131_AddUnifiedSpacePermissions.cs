using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddUnifiedSpacePermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SpaceOverrides_Member",
                table: "space_permission_overrides");

            migrationBuilder.DropIndex(
                name: "IX_SpaceOverrides_Role",
                table: "space_permission_overrides");

            migrationBuilder.Sql(
                """
                WITH ranked AS (
                    SELECT
                        "id",
                        ROW_NUMBER() OVER (
                            PARTITION BY "space_id", "role_id", "permission_id"
                            ORDER BY "created_at" DESC, "id" DESC
                        ) AS row_number
                    FROM "space_permission_overrides"
                    WHERE "role_id" IS NOT NULL
                )
                DELETE FROM "space_permission_overrides" AS target
                USING ranked
                WHERE target."id" = ranked."id"
                  AND ranked.row_number > 1;
                """);

            migrationBuilder.Sql(
                """
                WITH ranked AS (
                    SELECT
                        "id",
                        ROW_NUMBER() OVER (
                            PARTITION BY "space_id", "member_id", "permission_id"
                            ORDER BY "created_at" DESC, "id" DESC
                        ) AS row_number
                    FROM "space_permission_overrides"
                    WHERE "member_id" IS NOT NULL
                )
                DELETE FROM "space_permission_overrides" AS target
                USING ranked
                WHERE target."id" = ranked."id"
                  AND ranked.row_number > 1;
                """);

            migrationBuilder.InsertData(
                table: "permission_catalog",
                columns: new[] { "id", "code", "created_at", "description", "title" },
                values: new object[,]
                {
                    { new Guid("24000000-0000-0000-0000-000000000206"), "view_space", new DateTime(2026, 5, 14, 0, 0, 0, 0, DateTimeKind.Utc), null, "View space" },
                    { new Guid("24000000-0000-0000-0000-000000000207"), "send_messages", new DateTime(2026, 5, 14, 0, 0, 0, 0, DateTimeKind.Utc), null, "Send messages" },
                    { new Guid("24000000-0000-0000-0000-000000000208"), "connect_voice", new DateTime(2026, 5, 14, 0, 0, 0, 0, DateTimeKind.Utc), null, "Connect to voice" },
                    { new Guid("24000000-0000-0000-0000-000000000209"), "manage_space", new DateTime(2026, 5, 14, 0, 0, 0, 0, DateTimeKind.Utc), null, "Manage space" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_SpaceOverrides_Member",
                table: "space_permission_overrides",
                columns: new[] { "space_id", "member_id", "permission_id" },
                unique: true,
                filter: "\"member_id\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_SpaceOverrides_Role",
                table: "space_permission_overrides",
                columns: new[] { "space_id", "role_id", "permission_id" },
                unique: true,
                filter: "\"role_id\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SpaceOverrides_Member",
                table: "space_permission_overrides");

            migrationBuilder.DropIndex(
                name: "IX_SpaceOverrides_Role",
                table: "space_permission_overrides");

            migrationBuilder.Sql(
                """
                DELETE FROM "space_permission_overrides"
                WHERE "permission_id" IN (
                    '24000000-0000-0000-0000-000000000206',
                    '24000000-0000-0000-0000-000000000207',
                    '24000000-0000-0000-0000-000000000208',
                    '24000000-0000-0000-0000-000000000209'
                );

                DELETE FROM "server_role_permissions"
                WHERE "permission_id" IN (
                    '24000000-0000-0000-0000-000000000206',
                    '24000000-0000-0000-0000-000000000207',
                    '24000000-0000-0000-0000-000000000208',
                    '24000000-0000-0000-0000-000000000209'
                );
                """);

            migrationBuilder.DeleteData(
                table: "permission_catalog",
                keyColumn: "id",
                keyValue: new Guid("24000000-0000-0000-0000-000000000206"));

            migrationBuilder.DeleteData(
                table: "permission_catalog",
                keyColumn: "id",
                keyValue: new Guid("24000000-0000-0000-0000-000000000207"));

            migrationBuilder.DeleteData(
                table: "permission_catalog",
                keyColumn: "id",
                keyValue: new Guid("24000000-0000-0000-0000-000000000208"));

            migrationBuilder.DeleteData(
                table: "permission_catalog",
                keyColumn: "id",
                keyValue: new Guid("24000000-0000-0000-0000-000000000209"));

            migrationBuilder.CreateIndex(
                name: "IX_SpaceOverrides_Member",
                table: "space_permission_overrides",
                columns: new[] { "space_id", "member_id", "permission_id" });

            migrationBuilder.CreateIndex(
                name: "IX_SpaceOverrides_Role",
                table: "space_permission_overrides",
                columns: new[] { "space_id", "role_id", "permission_id" });
        }
    }
}
