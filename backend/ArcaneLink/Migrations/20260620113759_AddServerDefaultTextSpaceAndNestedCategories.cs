using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddServerDefaultTextSpaceAndNestedCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "default_text_space_id",
                table: "servers",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_servers_default_text_space_id",
                table: "servers",
                column: "default_text_space_id");

            migrationBuilder.AddForeignKey(
                name: "FK_servers_spaces_default_text_space_id",
                table: "servers",
                column: "default_text_space_id",
                principalTable: "spaces",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_servers_spaces_default_text_space_id",
                table: "servers");

            migrationBuilder.DropIndex(
                name: "IX_servers_default_text_space_id",
                table: "servers");

            migrationBuilder.DropColumn(
                name: "default_text_space_id",
                table: "servers");
        }
    }
}
