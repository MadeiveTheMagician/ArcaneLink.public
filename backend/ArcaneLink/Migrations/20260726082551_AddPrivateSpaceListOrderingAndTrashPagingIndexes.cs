using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddPrivateSpaceListOrderingAndTrashPagingIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "list_position",
                table: "private_space_members",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_SpaceMessages_PrivateTrashPage",
                table: "space_messages",
                columns: new[] { "space_id", "deleted_by_user_id", "deleted_at", "id" },
                filter: "\"deleted_at\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_SpaceMessageUserDeletions_User_DeletedAt_Message",
                table: "space_message_user_deletions",
                columns: new[] { "user_id", "deleted_at", "message_id" });

            migrationBuilder.CreateIndex(
                name: "IX_PrivateSpaceMembers_User_Status_ListPosition",
                table: "private_space_members",
                columns: new[] { "user_id", "status_id", "list_position" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SpaceMessages_PrivateTrashPage",
                table: "space_messages");

            migrationBuilder.DropIndex(
                name: "IX_SpaceMessageUserDeletions_User_DeletedAt_Message",
                table: "space_message_user_deletions");

            migrationBuilder.DropIndex(
                name: "IX_PrivateSpaceMembers_User_Status_ListPosition",
                table: "private_space_members");

            migrationBuilder.DropColumn(
                name: "list_position",
                table: "private_space_members");
        }
    }
}
