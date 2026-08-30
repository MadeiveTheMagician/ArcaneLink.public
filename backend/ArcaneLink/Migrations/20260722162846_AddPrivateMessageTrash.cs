using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddPrivateMessageTrash : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_space_read_states_space_messages_last_read_message_id",
                table: "space_read_states");

            migrationBuilder.AddColumn<Guid>(
                name: "deleted_by_user_id",
                table: "space_messages",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "space_message_user_deletions",
                columns: table => new
                {
                    message_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    restore_until = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_space_message_user_deletions", x => new { x.message_id, x.user_id });
                    table.ForeignKey(
                        name: "FK_space_message_user_deletions_space_messages_message_id",
                        column: x => x.message_id,
                        principalTable: "space_messages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_space_message_user_deletions_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SpaceMessages_PrivateTrashExpiry",
                table: "space_messages",
                columns: new[] { "deleted_at", "deleted_by_user_id" },
                filter: "\"deleted_at\" IS NOT NULL AND \"deleted_by_user_id\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_space_messages_deleted_by_user_id",
                table: "space_messages",
                column: "deleted_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_SpaceMessageUserDeletions_User_RestoreUntil",
                table: "space_message_user_deletions",
                columns: new[] { "user_id", "restore_until" });

            migrationBuilder.AddForeignKey(
                name: "FK_space_messages_users_deleted_by_user_id",
                table: "space_messages",
                column: "deleted_by_user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_space_messages_users_deleted_by_user_id",
                table: "space_messages");

            migrationBuilder.DropTable(
                name: "space_message_user_deletions");

            migrationBuilder.DropIndex(
                name: "IX_SpaceMessages_PrivateTrashExpiry",
                table: "space_messages");

            migrationBuilder.DropIndex(
                name: "IX_space_messages_deleted_by_user_id",
                table: "space_messages");

            migrationBuilder.DropColumn(
                name: "deleted_by_user_id",
                table: "space_messages");

            migrationBuilder.Sql(
                """
                UPDATE space_read_states AS state
                SET last_read_message_id = NULL
                WHERE state.last_read_message_id IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM space_messages AS message
                      WHERE message.id = state.last_read_message_id
                  );
                """);

            migrationBuilder.AddForeignKey(
                name: "FK_space_read_states_space_messages_last_read_message_id",
                table: "space_read_states",
                column: "last_read_message_id",
                principalTable: "space_messages",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
