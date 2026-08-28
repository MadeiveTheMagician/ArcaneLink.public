using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddServerMemberBans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ban_reason",
                table: "server_members",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "banned_at",
                table: "server_members",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "banned_by_user_id",
                table: "server_members",
                type: "uuid",
                nullable: true);

            migrationBuilder.InsertData(
                table: "server_audit_event_types",
                columns: new[] { "id", "code", "description", "title" },
                values: new object[,]
                {
                    { new Guid("24000000-0000-0000-0000-000000000317"), "member_banned", null, "Member banned" },
                    { new Guid("24000000-0000-0000-0000-000000000318"), "member_unbanned", null, "Member unbanned" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_ServerMembers_Server_Status_BannedAt",
                table: "server_members",
                columns: new[] { "server_id", "status_id", "banned_at" });

            migrationBuilder.CreateIndex(
                name: "IX_server_members_banned_by_user_id",
                table: "server_members",
                column: "banned_by_user_id");

            migrationBuilder.AddForeignKey(
                name: "FK_server_members_users_banned_by_user_id",
                table: "server_members",
                column: "banned_by_user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_server_members_users_banned_by_user_id",
                table: "server_members");

            migrationBuilder.DropIndex(
                name: "IX_ServerMembers_Server_Status_BannedAt",
                table: "server_members");

            migrationBuilder.DropIndex(
                name: "IX_server_members_banned_by_user_id",
                table: "server_members");

            migrationBuilder.DeleteData(
                table: "server_audit_event_types",
                keyColumn: "id",
                keyValue: new Guid("24000000-0000-0000-0000-000000000317"));

            migrationBuilder.DeleteData(
                table: "server_audit_event_types",
                keyColumn: "id",
                keyValue: new Guid("24000000-0000-0000-0000-000000000318"));

            migrationBuilder.DropColumn(
                name: "ban_reason",
                table: "server_members");

            migrationBuilder.DropColumn(
                name: "banned_at",
                table: "server_members");

            migrationBuilder.DropColumn(
                name: "banned_by_user_id",
                table: "server_members");
        }
    }
}
