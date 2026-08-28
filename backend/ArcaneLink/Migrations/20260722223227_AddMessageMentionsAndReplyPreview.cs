using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddMessageMentionsAndReplyPreview : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_user_notifications_space_messages_message_id",
                table: "user_notifications");

            migrationBuilder.CreateTable(
                name: "space_message_mentions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    message_id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    target_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    target_role_id = table.Column<Guid>(type: "uuid", nullable: true),
                    display_text = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    start = table.Column<int>(type: "integer", nullable: false),
                    length = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_space_message_mentions", x => x.id);
                    table.CheckConstraint("CK_SpaceMessageMentions_Kind_Target", "(\"kind\" = 'user' AND \"target_user_id\" IS NOT NULL AND \"target_role_id\" IS NULL) OR (\"kind\" = 'role' AND \"target_user_id\" IS NULL AND \"target_role_id\" IS NOT NULL) OR (\"kind\" = 'everyone' AND \"target_user_id\" IS NULL AND \"target_role_id\" IS NULL)");
                    table.CheckConstraint("CK_SpaceMessageMentions_Range", "\"start\" >= 0 AND \"length\" > 0");
                    table.ForeignKey(
                        name: "FK_space_message_mentions_server_roles_target_role_id",
                        column: x => x.target_role_id,
                        principalTable: "server_roles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_space_message_mentions_space_messages_message_id",
                        column: x => x.message_id,
                        principalTable: "space_messages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_space_message_mentions_users_target_user_id",
                        column: x => x.target_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SpaceMessageMentions_TargetRole",
                table: "space_message_mentions",
                column: "target_role_id");

            migrationBuilder.CreateIndex(
                name: "IX_SpaceMessageMentions_TargetUser",
                table: "space_message_mentions",
                column: "target_user_id");

            migrationBuilder.CreateIndex(
                name: "UX_SpaceMessageMentions_Message_Start",
                table: "space_message_mentions",
                columns: new[] { "message_id", "start" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_user_notifications_space_messages_message_id",
                table: "user_notifications",
                column: "message_id",
                principalTable: "space_messages",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_user_notifications_space_messages_message_id",
                table: "user_notifications");

            migrationBuilder.DropTable(
                name: "space_message_mentions");

            migrationBuilder.AddForeignKey(
                name: "FK_user_notifications_space_messages_message_id",
                table: "user_notifications",
                column: "message_id",
                principalTable: "space_messages",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
