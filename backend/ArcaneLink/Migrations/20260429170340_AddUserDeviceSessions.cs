using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddUserDeviceSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserDeviceSessions_RevokedAt",
                table: "user_device_sessions");

            migrationBuilder.DropIndex(
                name: "IX_UserDeviceSessions_UserId",
                table: "user_device_sessions");

            migrationBuilder.RenameIndex(
                name: "IX_UserDeviceSessions_User_LastUsedAt",
                table: "user_device_sessions",
                newName: "IX_UserDeviceSessions_User_LastUsed");

            migrationBuilder.CreateIndex(
                name: "IX_UserDeviceSessions_User_Revoked",
                table: "user_device_sessions",
                columns: new[] { "user_id", "revoked_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserDeviceSessions_User_Revoked",
                table: "user_device_sessions");

            migrationBuilder.RenameIndex(
                name: "IX_UserDeviceSessions_User_LastUsed",
                table: "user_device_sessions",
                newName: "IX_UserDeviceSessions_User_LastUsedAt");

            migrationBuilder.CreateIndex(
                name: "IX_UserDeviceSessions_RevokedAt",
                table: "user_device_sessions",
                column: "revoked_at");

            migrationBuilder.CreateIndex(
                name: "IX_UserDeviceSessions_UserId",
                table: "user_device_sessions",
                column: "user_id");
        }
    }
}
