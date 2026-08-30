using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class WidenPrivateTrashCleanupIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SpaceMessages_PrivateTrashExpiry",
                table: "space_messages");

            migrationBuilder.CreateIndex(
                name: "IX_SpaceMessages_PrivateTrashExpiry",
                table: "space_messages",
                columns: new[] { "deleted_at", "deleted_by_user_id" },
                filter: "\"deleted_at\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SpaceMessages_PrivateTrashExpiry",
                table: "space_messages");

            migrationBuilder.CreateIndex(
                name: "IX_SpaceMessages_PrivateTrashExpiry",
                table: "space_messages",
                columns: new[] { "deleted_at", "deleted_by_user_id" },
                filter: "\"deleted_at\" IS NOT NULL AND \"deleted_by_user_id\" IS NOT NULL");
        }
    }
}
