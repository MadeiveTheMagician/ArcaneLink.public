using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddPrivateSpaceFolders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "private_space_folders",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(48)", maxLength: 48, nullable: false),
                    icon = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    color = table.Column<string>(type: "character varying(9)", maxLength: 9, nullable: true),
                    position = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_private_space_folders", x => x.id);
                    table.ForeignKey(
                        name: "FK_private_space_folders_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "private_space_folder_items",
                columns: table => new
                {
                    folder_id = table.Column<Guid>(type: "uuid", nullable: false),
                    space_id = table.Column<Guid>(type: "uuid", nullable: false),
                    position = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_private_space_folder_items", x => new { x.folder_id, x.space_id });
                    table.ForeignKey(
                        name: "FK_private_space_folder_items_private_space_folders_folder_id",
                        column: x => x.folder_id,
                        principalTable: "private_space_folders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_private_space_folder_items_private_spaces_space_id",
                        column: x => x.space_id,
                        principalTable: "private_spaces",
                        principalColumn: "space_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PrivateSpaceFolderItems_Folder_Position",
                table: "private_space_folder_items",
                columns: new[] { "folder_id", "position" });

            migrationBuilder.CreateIndex(
                name: "IX_private_space_folder_items_space_id",
                table: "private_space_folder_items",
                column: "space_id");

            migrationBuilder.CreateIndex(
                name: "IX_PrivateSpaceFolders_User_Position",
                table: "private_space_folders",
                columns: new[] { "user_id", "position" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "private_space_folder_items");

            migrationBuilder.DropTable(
                name: "private_space_folders");
        }
    }
}
