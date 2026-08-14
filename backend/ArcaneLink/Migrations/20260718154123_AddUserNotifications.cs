using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddUserNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "user_notifications",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    title = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    body = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    detail = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    actor_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    server_id = table.Column<Guid>(type: "uuid", nullable: true),
                    space_id = table.Column<Guid>(type: "uuid", nullable: true),
                    message_id = table.Column<Guid>(type: "uuid", nullable: true),
                    invite_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    read_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_notifications", x => x.id);
                    table.ForeignKey(
                        name: "FK_user_notifications_server_invites_invite_id",
                        column: x => x.invite_id,
                        principalTable: "server_invites",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_user_notifications_servers_server_id",
                        column: x => x.server_id,
                        principalTable: "servers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_user_notifications_space_messages_message_id",
                        column: x => x.message_id,
                        principalTable: "space_messages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_user_notifications_spaces_space_id",
                        column: x => x.space_id,
                        principalTable: "spaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_user_notifications_users_actor_user_id",
                        column: x => x.actor_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_user_notifications_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserNotifications_User_Invite",
                table: "user_notifications",
                columns: new[] { "user_id", "invite_id" },
                unique: true,
                filter: "\"invite_id\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_UserNotifications_User_Message",
                table: "user_notifications",
                columns: new[] { "user_id", "message_id" },
                unique: true,
                filter: "\"message_id\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_UserNotifications_User_Read",
                table: "user_notifications",
                columns: new[] { "user_id", "read_at" });

            migrationBuilder.CreateIndex(
                name: "IX_UserNotifications_User_Time",
                table: "user_notifications",
                columns: new[] { "user_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_user_notifications_actor_user_id",
                table: "user_notifications",
                column: "actor_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_user_notifications_invite_id",
                table: "user_notifications",
                column: "invite_id");

            migrationBuilder.CreateIndex(
                name: "IX_user_notifications_message_id",
                table: "user_notifications",
                column: "message_id");

            migrationBuilder.CreateIndex(
                name: "IX_user_notifications_server_id",
                table: "user_notifications",
                column: "server_id");

            migrationBuilder.CreateIndex(
                name: "IX_user_notifications_space_id",
                table: "user_notifications",
                column: "space_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "user_notifications");
        }
    }
}
