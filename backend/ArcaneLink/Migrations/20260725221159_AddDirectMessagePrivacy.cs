using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddDirectMessagePrivacy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "direct_message_permission",
                table: "user_profile_settings",
                type: "character varying(24)",
                maxLength: 24,
                nullable: false,
                defaultValue: "everyone");

            migrationBuilder.CreateTable(
                name: "user_direct_message_blocks",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    blocked_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_direct_message_blocks", x => new { x.user_id, x.blocked_user_id });
                    table.CheckConstraint("CK_UserDirectMessageBlocks_DifferentUsers", "\"user_id\" <> \"blocked_user_id\"");
                    table.ForeignKey(
                        name: "FK_user_direct_message_blocks_users_blocked_user_id",
                        column: x => x.blocked_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_user_direct_message_blocks_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserProfileSettings_DirectMessagePermission",
                table: "user_profile_settings",
                sql: "direct_message_permission IN ('everyone', 'friends', 'shared_servers', 'nobody')");

            migrationBuilder.CreateIndex(
                name: "IX_UserDirectMessageBlocks_Blocked_User",
                table: "user_direct_message_blocks",
                columns: new[] { "blocked_user_id", "user_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "user_direct_message_blocks");

            migrationBuilder.DropCheckConstraint(
                name: "CK_UserProfileSettings_DirectMessagePermission",
                table: "user_profile_settings");

            migrationBuilder.DropColumn(
                name: "direct_message_permission",
                table: "user_profile_settings");
        }
    }
}
