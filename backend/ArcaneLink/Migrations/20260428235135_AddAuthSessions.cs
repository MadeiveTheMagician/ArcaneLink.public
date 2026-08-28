using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddAuthSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "device_session_id",
                table: "user_refresh_tokens",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "user_device_sessions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    last_used_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    revoked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ip_address = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    user_agent = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    device_name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_device_sessions", x => x.id);
                    table.ForeignKey(
                        name: "FK_user_device_sessions_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserRefreshTokens_DeviceSessionId",
                table: "user_refresh_tokens",
                column: "device_session_id");

            migrationBuilder.CreateIndex(
                name: "IX_UserDeviceSessions_RevokedAt",
                table: "user_device_sessions",
                column: "revoked_at");

            migrationBuilder.CreateIndex(
                name: "IX_UserDeviceSessions_UserId",
                table: "user_device_sessions",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_UserDeviceSessions_User_LastUsedAt",
                table: "user_device_sessions",
                columns: new[] { "user_id", "last_used_at" });

            migrationBuilder.AddForeignKey(
                name: "FK_user_refresh_tokens_user_device_sessions_device_session_id",
                table: "user_refresh_tokens",
                column: "device_session_id",
                principalTable: "user_device_sessions",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_user_refresh_tokens_user_device_sessions_device_session_id",
                table: "user_refresh_tokens");

            migrationBuilder.DropTable(
                name: "user_device_sessions");

            migrationBuilder.DropIndex(
                name: "IX_UserRefreshTokens_DeviceSessionId",
                table: "user_refresh_tokens");

            migrationBuilder.DropColumn(
                name: "device_session_id",
                table: "user_refresh_tokens");
        }
    }
}
