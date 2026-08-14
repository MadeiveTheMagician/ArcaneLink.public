using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddServerAccessModesAndJoinRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "access_mode",
                table: "servers",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "private");

            migrationBuilder.Sql(
                """
                UPDATE "servers"
                SET "access_mode" = CASE
                    WHEN "is_public" THEN 'public'
                    ELSE 'private'
                END;
                """);

            migrationBuilder.DropColumn(
                name: "is_public",
                table: "servers");

            migrationBuilder.CreateTable(
                name: "server_join_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    server_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status_code = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    reviewed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    reviewed_by_user_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_server_join_requests", x => x.id);
                    table.CheckConstraint("CK_ServerJoinRequests_StatusCode", "\"status_code\" IN ('pending', 'approved', 'declined', 'cancelled')");
                    table.ForeignKey(
                        name: "FK_server_join_requests_servers_server_id",
                        column: x => x.server_id,
                        principalTable: "servers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_server_join_requests_users_reviewed_by_user_id",
                        column: x => x.reviewed_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_server_join_requests_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Servers_AccessMode_Time",
                table: "servers",
                columns: new[] { "access_mode", "updated_at" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_Servers_AccessMode",
                table: "servers",
                sql: "\"access_mode\" IN ('public', 'restricted', 'private')");

            migrationBuilder.CreateIndex(
                name: "IX_ServerJoinRequests_Server_Status_Time",
                table: "server_join_requests",
                columns: new[] { "server_id", "status_code", "created_at", "id" });

            migrationBuilder.CreateIndex(
                name: "IX_ServerJoinRequests_User_Status_Time",
                table: "server_join_requests",
                columns: new[] { "user_id", "status_code", "updated_at" });

            migrationBuilder.CreateIndex(
                name: "IX_server_join_requests_reviewed_by_user_id",
                table: "server_join_requests",
                column: "reviewed_by_user_id");

            migrationBuilder.CreateIndex(
                name: "UX_ServerJoinRequests_Server_User_Pending",
                table: "server_join_requests",
                columns: new[] { "server_id", "user_id" },
                unique: true,
                filter: "\"status_code\" = 'pending'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "server_join_requests");

            migrationBuilder.DropIndex(
                name: "IX_Servers_AccessMode_Time",
                table: "servers");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Servers_AccessMode",
                table: "servers");

            migrationBuilder.AddColumn<bool>(
                name: "is_public",
                table: "servers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql(
                """
                UPDATE "servers"
                SET "is_public" = "access_mode" = 'public';
                """);

            migrationBuilder.DropColumn(
                name: "access_mode",
                table: "servers");
        }
    }
}
